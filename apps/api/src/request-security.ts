import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { hexToBytes } from '@noble/curves/abstract/utils';
import { ed25519 } from '@noble/curves/ed25519';
import { createSignaturePayload as createSharedSignaturePayload } from '@qzd/shared/request-security';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const NONCE_HEADER = 'x-qzd-nonce';
const SIGNATURE_HEADER = 'x-qzd-signature';

const DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX =
  '855ccfa13e665195273601418ba69eae333ff5ef6a7123738247871e5d4732a8';

const HEX_PATTERN = /^([0-9a-fA-F]{2})+$/;

function decodeHex(value: string, errorFactory: () => Error): Uint8Array {
  if (!HEX_PATTERN.test(value)) {
    throw errorFactory();
  }
  return hexToBytes(value);
}

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyGenerator?: (request: Request) => string | undefined;
}

interface RequestSecurityOptions {
  publicKeyHex?: string;
  rateLimit?: RateLimitOptions;
}

export interface SignatureComponents {
  method: string;
  path: string;
  idempotencyKey: string;
  nonce: string;
  serializedBody: string;
}

export interface ValidatedMutationContext {
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

export function createSignaturePayload(components: SignatureComponents): Uint8Array {
  return createSharedSignaturePayload(
    components.method,
    components.path,
    components.idempotencyKey,
    components.nonce,
    components.serializedBody,
  );
}

export class RequestSecurityManager {
  private readonly usedNonces = new Set<string>();
  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();
  private readonly publicKeyBytes: Uint8Array;
  private readonly rateLimiter?: RequestRateLimiter;

  constructor(options: RequestSecurityOptions = {}) {
    const publicKeyHex =
      options.publicKeyHex ??
      process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY ??
      DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX;

    this.publicKeyBytes = decodeHex(
      publicKeyHex,
      () =>
        new Error(
          'QZD_REQUEST_SIGNING_PUBLIC_KEY must be a hex-encoded string representing an Ed25519 public key.',
        ),
    );

    const rateLimit = this.normalizeRateLimitOptions(options.rateLimit);
    if (rateLimit) {
      this.rateLimiter = new RequestRateLimiter(rateLimit);
    }
  }

  validateMutation(request: Request, body: unknown): ValidatedMutationContext {
    const method = this.normalizeMethod(request);
    const path = this.normalizePath(request);
    const idempotencyKey = this.requireHeader(request, IDEMPOTENCY_HEADER, 'Idempotency-Key header is required');
    const nonce = this.requireHeader(request, NONCE_HEADER, 'X-QZD-Nonce header is required');
    const signatureHex = this.requireHeader(request, SIGNATURE_HEADER, 'X-QZD-Signature header is required');

    const signatureBytes = this.decodeHex(signatureHex, 'X-QZD-Signature header must be a hex-encoded string');
    const serializedBody = serializeBody(body);
    const payload = createSignaturePayload({ method, path, idempotencyKey, nonce, serializedBody });

    const isValid = ed25519.verify(signatureBytes, payload, this.publicKeyBytes);
    if (!isValid) {
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Request signature is invalid.',
      });
    }

    const rateLimitState = this.rateLimiter?.consume(request);
    this.applyRateLimitHeaders(request, rateLimitState);
    if (rateLimitState?.limited) {
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
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

  private getResponse(request: Request): HeaderWritableResponse | undefined {
    const requestLike = request as Partial<Request> & { res?: unknown };
    const response = requestLike.res;
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const candidate = response as Partial<HeaderWritableResponse>;
    return typeof candidate.set === 'function'
      ? (candidate as HeaderWritableResponse)
      : undefined;
  }

  private decodeHex(value: string, message: string): Uint8Array {
    return decodeHex(value, () => new BadRequestException(message));
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

  private normalizeRateLimitOptions(options?: RateLimitOptions): NormalizedRateLimitOptions | undefined {
    if (!options) {
      return undefined;
    }

    const limit = Number.isFinite(options.limit) ? Math.floor(options.limit) : Number.NaN;
    const windowMs = Number.isFinite(options.windowMs) ? Math.floor(options.windowMs) : Number.NaN;
    if (!Number.isFinite(limit) || !Number.isFinite(windowMs) || limit <= 0 || windowMs <= 0) {
      return undefined;
    }

    return {
      limit,
      windowMs,
      keyGenerator: options.keyGenerator,
    } satisfies NormalizedRateLimitOptions;
  }

  private applyRateLimitHeaders(request: Request, state?: RateLimitState): void {
    if (!state) {
      return;
    }

    const response = this.getResponse(request);
    if (!response) {
      return;
    }

    response.set('X-RateLimit-Limit', state.limit.toString());
    response.set('X-RateLimit-Remaining', Math.max(0, state.remaining).toString());
    response.set('X-RateLimit-Reset', Math.ceil(state.resetAt / 1000).toString());
    if (state.limited && typeof state.retryAfterSeconds === 'number') {
      response.set('Retry-After', Math.max(1, state.retryAfterSeconds).toString());
    }
  }
}

interface NormalizedRateLimitOptions {
  limit: number;
  windowMs: number;
  keyGenerator?: (request: Request) => string | undefined;
}

interface RateLimitState {
  limit: number;
  remaining: number;
  resetAt: number;
  limited: boolean;
  retryAfterSeconds?: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

class RequestRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly options: NormalizedRateLimitOptions) {}

  consume(request: Request): RateLimitState {
    const key = this.options.keyGenerator?.(request) ?? this.extractKey(request);
    const now = Date.now();
    const limit = this.options.limit;
    const windowMs = this.options.windowMs;

    if (!key) {
      return {
        limit,
        remaining: limit,
        resetAt: now + windowMs,
        limited: false,
      } satisfies RateLimitState;
    }

    const existing = this.buckets.get(key);
    const bucket: RateLimitBucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs };

    if (bucket.count >= limit) {
      const retryAfterMs = bucket.resetAt - now;
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      this.buckets.set(key, bucket);
      return {
        limit,
        remaining: 0,
        resetAt: bucket.resetAt,
        limited: true,
        retryAfterSeconds,
      } satisfies RateLimitState;
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);
    const remaining = Math.max(0, limit - bucket.count);

    return {
      limit,
      remaining,
      resetAt: bucket.resetAt,
      limited: false,
    } satisfies RateLimitState;
  }

  private extractKey(request: Request): string | undefined {
    const requestLike = request as Partial<Request> & {
      ip?: string;
      ips?: string[];
    };

    if (Array.isArray(requestLike.ips) && requestLike.ips.length > 0) {
      return requestLike.ips[0] ?? undefined;
    }

    if (typeof requestLike.ip === 'string' && requestLike.ip) {
      return requestLike.ip;
    }

    const headers = this.getHeaders(request);
    const forwarded = headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0]?.trim() || undefined;
    }

    return 'global';
  }

  private getHeaders(request: Request): Record<string, unknown> {
    const requestLike = request as Partial<Request> & { headers?: unknown };
    const candidate = requestLike.headers;
    if (candidate && typeof candidate === 'object') {
      return candidate as Record<string, unknown>;
    }
    return {};
  }
}

interface HeaderWritableResponse {
  set(field: string, value: string): unknown;
}
