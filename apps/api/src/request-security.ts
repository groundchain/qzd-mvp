import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { ed25519 } from '@noble/curves/ed25519';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const NONCE_HEADER = 'x-qzd-nonce';
const SIGNATURE_HEADER = 'x-qzd-signature';

const DEV_SIGNING_PRIVATE_KEY_HEX = '0a3c8c97f7925ea37e46f69af43e219b1d09de89ec1a76cf2ce9a9289a392d5a';
const DEV_SIGNING_PUBLIC_KEY_HEX = bytesToHex(ed25519.getPublicKey(hexToBytes(DEV_SIGNING_PRIVATE_KEY_HEX)));
const DEV_SIGNING_PUBLIC_KEY_BYTES = hexToBytes(DEV_SIGNING_PUBLIC_KEY_HEX);

export interface SignatureComponents {
  method: string;
  path: string;
  idempotencyKey: string;
  nonce: string;
  serializedBody: string;
}

interface ValidatedMutationContext {
  scope: string;
  bodyHash: string;
}

interface IdempotencyRecord {
  bodyHash: string;
  response: unknown;
}

export function serializeBody(body: unknown): string {
  if (body === undefined) {
    return 'null';
  }
  return JSON.stringify(body ?? null);
}

export function createSignaturePayload({
  method,
  path,
  idempotencyKey,
  nonce,
  serializedBody,
}: SignatureComponents): Uint8Array {
  const canonical = `${method}\n${path}\n${idempotencyKey}\n${nonce}\n${serializedBody}`;
  return new TextEncoder().encode(canonical);
}

export const DEV_SIGNING_KEYPAIR = {
  privateKey: DEV_SIGNING_PRIVATE_KEY_HEX,
  publicKey: DEV_SIGNING_PUBLIC_KEY_HEX,
} as const;

export class RequestSecurityManager {
  private readonly usedNonces = new Set<string>();
  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();

  validateMutation(request: Request, body: unknown): ValidatedMutationContext {
    const method = this.normalizeMethod(request);
    const path = this.normalizePath(request);
    const idempotencyKey = this.requireHeader(request, IDEMPOTENCY_HEADER, 'Idempotency-Key header is required');
    const nonce = this.requireHeader(request, NONCE_HEADER, 'X-QZD-Nonce header is required');
    const signatureHex = this.requireHeader(request, SIGNATURE_HEADER, 'X-QZD-Signature header is required');

    const signatureBytes = this.decodeHex(signatureHex, 'X-QZD-Signature header must be a hex-encoded string');
    const serializedBody = serializeBody(body);
    const payload = createSignaturePayload({ method, path, idempotencyKey, nonce, serializedBody });

    const isValid = ed25519.verify(signatureBytes, payload, DEV_SIGNING_PUBLIC_KEY_BYTES);
    if (!isValid) {
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Request signature is invalid.',
      });
    }

    if (this.usedNonces.has(nonce)) {
      throw new ConflictException({
        code: 'REPLAY_DETECTED',
        message: 'Nonce has already been used.',
      });
    }

    this.usedNonces.add(nonce);

    const scope = `${method}:${path}:${idempotencyKey}`;
    const bodyHash = this.hash(serializedBody);

    return { scope, bodyHash } satisfies ValidatedMutationContext;
  }

  applyIdempotency<T>(context: ValidatedMutationContext, factory: () => T): T {
    const existing = this.idempotencyRecords.get(context.scope);
    if (existing) {
      if (existing.bodyHash !== context.bodyHash) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Idempotency key has already been used with a different payload.',
        });
      }
      return this.clone(existing.response) as T;
    }

    const result = factory();
    this.idempotencyRecords.set(context.scope, {
      bodyHash: context.bodyHash,
      response: this.clone(result),
    });

    return result;
  }

  private normalizeMethod(request: Request): string {
    const candidate = (request as Partial<Request> & { method?: string }).method;
    return typeof candidate === 'string' && candidate ? candidate.toUpperCase() : 'POST';
  }

  private normalizePath(request: Request): string {
    const requestLike = request as Partial<Request> & { originalUrl?: string; url?: string };
    const original = typeof requestLike.originalUrl === 'string' ? requestLike.originalUrl : requestLike.url ?? '';
    const [path] = original.split('?');
    return path || '/';
  }

  private requireHeader(request: Request, name: string, message: string): string {
    const headers = this.getHeaders(request);
    const candidate = headers[name] ?? headers[name.toLowerCase()];
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
  }

  private getHeaders(request: Request): Record<string, unknown> {
    const requestLike = request as Partial<Request> & { headers?: unknown };
    const candidate = requestLike.headers;
    if (candidate && typeof candidate === 'object') {
      return candidate as Record<string, unknown>;
    }
    return {};
  }

  private decodeHex(value: string, message: string): Uint8Array {
    if (!/^([0-9a-fA-F]{2})+$/.test(value)) {
      throw new BadRequestException(message);
    }
    return hexToBytes(value);
  }

  private hash(serialized: string): string {
    return createHash('sha256').update(serialized).digest('hex');
  }

  private clone<T>(value: T): T {
    if (typeof globalThis.structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
