import supertest from 'supertest';
import {
  DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX,
  applyMutationSecurityHeaders,
  createMutationSecurityHeaders,
  type MutationSecurityHeaders,
  type MutationSecurityOverrides,
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

type SecurityHeaders = MutationSecurityHeaders;

type SecurityOverrides = MutationSecurityOverrides;

const DEV_SIGNING_PUBLIC_KEY_HEX = DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX;

function applySecurity(
  request: ChainableTest,
  method: string,
  path: string,
  body: unknown,
  overrides: SecurityOverrides = {},
): { request: ChainableTest; headers: SecurityHeaders } {
  const headers = createMutationSecurityHeaders(method, path, body, overrides);
  applyMutationSecurityHeaders(request, headers);
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
