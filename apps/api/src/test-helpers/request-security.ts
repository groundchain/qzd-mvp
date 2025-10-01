import { randomBytes } from 'node:crypto';
import supertest from 'supertest';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import {
  DEFAULT_DEV_SIGNING_PRIVATE_KEY_HEX,
  DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX,
  createIdempotencyKey,
  createSignaturePayloadFromComponents as createSignaturePayload,
  serializeBody,
} from '@qzd/shared/request-security';

type HeaderValue = string | number | readonly string[];

type ResponseWithBody = { status: number; body: Record<string, unknown> };

type ChainableTest = supertest.Test &
  PromiseLike<ResponseWithBody> & {
    set(field: string, value: HeaderValue): ChainableTest;
    set(fields: Record<string, HeaderValue>): ChainableTest;
    send(body?: unknown): ChainableTest;
  };

type TestClient = { post(path: string): ChainableTest; get(path: string): ChainableTest };

type SecurityOverrides = {
  idempotencyKey?: string;
  nonce?: string;
};

interface SecurityHeaders {
  idempotencyKey: string;
  nonce: string;
  signature: string;
}

const DEV_SIGNING_PRIVATE_KEY_BYTES = hexToBytes(DEFAULT_DEV_SIGNING_PRIVATE_KEY_HEX);
const DEV_SIGNING_PUBLIC_KEY_HEX = DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX;

function buildSecurityHeaders(
  method: string,
  path: string,
  body: unknown,
  overrides: SecurityOverrides = {},
): SecurityHeaders {
  const idempotencyKey = overrides.idempotencyKey ?? createIdempotencyKey();
  const nonce = overrides.nonce ?? bytesToHex(randomBytes(16));
  const serializedBody = serializeBody(body);
  const payload = createSignaturePayload({
    method,
    path,
    idempotencyKey,
    nonce,
    serializedBody,
  });
  const signature = bytesToHex(ed25519.sign(payload, DEV_SIGNING_PRIVATE_KEY_BYTES));
  return { idempotencyKey, nonce, signature };
}

function applySecurity(
  request: ChainableTest,
  method: string,
  path: string,
  body: unknown,
  overrides: SecurityOverrides = {},
): { request: ChainableTest; headers: SecurityHeaders } {
  const headers = buildSecurityHeaders(method, path, body, overrides);
  request
    .set('Idempotency-Key', headers.idempotencyKey)
    .set('X-QZD-Nonce', headers.nonce)
    .set('X-QZD-Signature', headers.signature);
  return { request, headers };
}

function createTestClient(server: Parameters<typeof supertest>[0]): TestClient {
  return supertest(server) as unknown as TestClient;
}

function getResponseBody<T extends Record<string, unknown>>(response: ResponseWithBody): T {
  return response.body as T;
}

type ErrorPayload = {
  code?: string;
  message?: { code?: string; message?: string } | string;
};

function extractErrorDetails(payload: ErrorPayload): { code?: string; message?: string } {
  if (typeof payload.message === 'object' && payload.message) {
    return {
      code: payload.message.code ?? payload.code,
      message: payload.message.message,
    };
  }

  return {
    code: payload.code,
    message: typeof payload.message === 'string' ? payload.message : undefined,
  };
}

export {
  applySecurity,
  buildSecurityHeaders,
  createTestClient,
  extractErrorDetails,
  getResponseBody,
  DEV_SIGNING_PUBLIC_KEY_HEX,
};
export type {
  ChainableTest,
  ErrorPayload,
  ResponseWithBody,
  SecurityHeaders,
  SecurityOverrides,
  TestClient,
};
