import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { AppModule } from './app.module.js';
import { resetFallbackBankService } from './in-memory-bank.service.js';
import {
  createSignaturePayloadFromComponents as createSignaturePayload,
  serializeBody,
} from '@qzd/shared/request-security';

const DEV_SIGNING_PRIVATE_KEY_HEX =
  '0a3c8c97f7925ea37e46f69af43e219b1d09de89ec1a76cf2ce9a9289a392d5a';
const DEV_SIGNING_PUBLIC_KEY_HEX = bytesToHex(
  ed25519.getPublicKey(hexToBytes(DEV_SIGNING_PRIVATE_KEY_HEX)),
);

const RATE_LIMIT_MAX = '3';
const RATE_LIMIT_WINDOW_MS = '1000';

interface SecurityHeaders {
  idempotencyKey: string;
  nonce: string;
  signature: string;
}

type HeaderValue = string | number | readonly string[];

type HeaderMap = Record<string, string | string[] | undefined>;

type ResponseWithBody = supertest.Response & {
  body: Record<string, unknown>;
  headers: HeaderMap;
};

type ChainableTest = supertest.Test &
  PromiseLike<ResponseWithBody> & {
    set(field: string, value: HeaderValue): ChainableTest;
    set(fields: Record<string, HeaderValue>): ChainableTest;
    send(body?: unknown): ChainableTest;
  };

type TestClient = {
  post(path: string): ChainableTest;
};

function buildSecurityHeaders(
  method: string,
  path: string,
  body: unknown,
): SecurityHeaders {
  const idempotencyKey = `idem-${randomUUID()}`;
  const nonce = bytesToHex(randomBytes(16));
  const serializedBody = serializeBody(body);
  const payload = createSignaturePayload({
    method,
    path,
    idempotencyKey,
    nonce,
    serializedBody,
  });
  const signature = bytesToHex(
    ed25519.sign(payload, hexToBytes(DEV_SIGNING_PRIVATE_KEY_HEX)),
  );
  return { idempotencyKey, nonce, signature };
}

function applySecurity(
  request: ChainableTest,
  method: string,
  path: string,
  body: unknown,
): { request: ChainableTest; headers: SecurityHeaders } {
  const headers = buildSecurityHeaders(method, path, body);
  request
    .set('Idempotency-Key', headers.idempotencyKey)
    .set('X-QZD-Nonce', headers.nonce)
    .set('X-QZD-Signature', headers.signature);
  return { request, headers };
}

function getResponseBody<T extends Record<string, unknown>>(response: ResponseWithBody): T {
  return response.body as T;
}

function getHeader(headers: HeaderMap, name: string): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function extractErrorDetails(payload: Record<string, unknown>): {
  code?: string;
  message?: string;
} {
  const code = typeof payload.code === 'string' ? payload.code : undefined;
  const messageValue = payload.message;
  if (typeof messageValue === 'string') {
    return { code, message: messageValue };
  }

  if (messageValue && typeof messageValue === 'object') {
    const nested = messageValue as Record<string, unknown>;
    const nestedCode = typeof nested.code === 'string' ? nested.code : code;
    const nestedMessage =
      typeof nested.message === 'string' ? nested.message : undefined;
    return { code: nestedCode, message: nestedMessage };
  }

  return { code, message: undefined };
}

describe('Rate limiting', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let previousRateLimitMax: string | undefined;
  let previousRateLimitWindow: string | undefined;
  let previousSigningKey: string | undefined;

  beforeAll(async () => {
    previousRateLimitMax = process.env.QZD_RATE_LIMIT_MAX;
    previousRateLimitWindow = process.env.QZD_RATE_LIMIT_WINDOW_MS;
    previousSigningKey = process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY;

    process.env.QZD_RATE_LIMIT_MAX = RATE_LIMIT_MAX;
    process.env.QZD_RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MS;
    process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY = DEV_SIGNING_PUBLIC_KEY_HEX;

    resetFallbackBankService();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();

    if (typeof previousRateLimitMax === 'string') {
      process.env.QZD_RATE_LIMIT_MAX = previousRateLimitMax;
    } else {
      delete process.env.QZD_RATE_LIMIT_MAX;
    }

    if (typeof previousRateLimitWindow === 'string') {
      process.env.QZD_RATE_LIMIT_WINDOW_MS = previousRateLimitWindow;
    } else {
      delete process.env.QZD_RATE_LIMIT_WINDOW_MS;
    }

    if (typeof previousSigningKey === 'string') {
      process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY = previousSigningKey;
    } else {
      delete process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY;
    }

    resetFallbackBankService();
  });

  const client = (): TestClient => supertest(server) as unknown as TestClient;

  function performRegistration(): ChainableTest {
    const path = '/auth/register';
    const body = {
      email: `ratelimit-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      password: 'Pass1234!',
      fullName: 'Rate Limit User',
    } as const;

    const { request } = applySecurity(client().post(path), 'POST', path, body);
    return request.send(body);
  }

  it('throttles repeated write requests and exposes retry headers', async () => {
    const first = (await performRegistration().expect(201)) as ResponseWithBody;
    expect(getHeader(first.headers, 'x-ratelimit-limit')).toBe(RATE_LIMIT_MAX);
    expect(getHeader(first.headers, 'x-ratelimit-remaining')).toBe('2');

    const second = (await performRegistration().expect(201)) as ResponseWithBody;
    expect(getHeader(second.headers, 'x-ratelimit-limit')).toBe(RATE_LIMIT_MAX);
    expect(getHeader(second.headers, 'x-ratelimit-remaining')).toBe('1');

    const third = (await performRegistration().expect(201)) as ResponseWithBody;
    expect(getHeader(third.headers, 'x-ratelimit-limit')).toBe(RATE_LIMIT_MAX);
    expect(getHeader(third.headers, 'x-ratelimit-remaining')).toBe('0');

    const throttled = (await performRegistration().expect(429)) as ResponseWithBody;
    expect(getHeader(throttled.headers, 'x-ratelimit-limit')).toBe(RATE_LIMIT_MAX);
    expect(getHeader(throttled.headers, 'x-ratelimit-remaining')).toBe('0');

    const resetHeader = getHeader(throttled.headers, 'x-ratelimit-reset') ?? '';
    const reset = Number.parseInt(resetHeader, 10);
    expect(Number.isNaN(reset)).toBe(false);
    expect(reset).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000));

    const retryAfter = getHeader(throttled.headers, 'retry-after');
    expect(retryAfter).toBe('1');

    const throttledPayload = getResponseBody<Record<string, unknown>>(throttled);
    const { code, message } = extractErrorDetails(throttledPayload);
    expect(code).toBe('TOO_MANY_REQUESTS');
    expect(message).toBe('Rate limit exceeded.');
  });
});
