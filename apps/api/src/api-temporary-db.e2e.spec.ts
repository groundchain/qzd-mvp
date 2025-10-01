import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { AppModule } from './app.module.js';
import { InMemoryBankService } from './in-memory-bank.service.js';
import {
  createSignaturePayloadFromComponents as createSignaturePayload,
  serializeBody,
} from '@qzd/shared/request-security';

const DEV_SIGNING_PRIVATE_KEY_HEX =
  '0a3c8c97f7925ea37e46f69af43e219b1d09de89ec1a76cf2ce9a9289a392d5a';
const DEV_SIGNING_PUBLIC_KEY_HEX = bytesToHex(
  ed25519.getPublicKey(hexToBytes(DEV_SIGNING_PRIVATE_KEY_HEX)),
);

type SecurityOverrides = {
  idempotencyKey?: string;
  nonce?: string;
};

type SecurityHeaders = {
  idempotencyKey: string;
  nonce: string;
  signature: string;
};

type HeaderValue = string | number | readonly string[];

type ResponseWithBody = { status: number; body: Record<string, unknown> };

type ChainableTest = supertest.Test &
  PromiseLike<ResponseWithBody> & {
    set(field: string, value: HeaderValue): ChainableTest;
    set(fields: Record<string, HeaderValue>): ChainableTest;
    send(body?: unknown): ChainableTest;
  };

type TestClient = {
  post(path: string): ChainableTest;
  get(path: string): ChainableTest;
};

function buildSecurityHeaders(
  method: string,
  path: string,
  body: unknown,
  overrides: SecurityOverrides = {},
): SecurityHeaders {
  const idempotencyKey = overrides.idempotencyKey ?? `idem-${randomUUID()}`;
  const nonce = overrides.nonce ?? randomBytes(16).toString('hex');
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
  overrides: SecurityOverrides = {},
): { request: ChainableTest; headers: SecurityHeaders } {
  const headers = buildSecurityHeaders(method, path, body, overrides);
  request
    .set('Idempotency-Key', headers.idempotencyKey)
    .set('X-QZD-Nonce', headers.nonce)
    .set('X-QZD-Signature', headers.signature);
  return { request, headers };
}

function getResponseBody<T extends Record<string, unknown>>(response: ResponseWithBody): T {
  return response.body as T;
}

async function seedRecipientAccount(
  createClient: () => TestClient,
): Promise<{ accountId: string }> {
  const email = `recipient-${Date.now()}@example.com`;
  const password = 'Seed1234!';
  const fullName = 'Recipient User';
  const body = { email, password, fullName };

  const { request } = applySecurity(
    createClient().post('/auth/register'),
    'POST',
    '/auth/register',
    body,
  );

  const response = await request.send(body).expect(201);
  const payload = getResponseBody<{
    account?: { id?: string };
  }>(response);
  const accountId = payload.account?.id;
  if (!accountId) {
    throw new Error('Failed to seed recipient account');
  }

  return { accountId };
}

describe('API temporary database e2e', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let recipientAccountId: string;

  beforeAll(async () => {
    process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY = DEV_SIGNING_PUBLIC_KEY_HEX;
    const bank = new InMemoryBankService();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(InMemoryBankService)
      .useValue(bank)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    const seed = await seedRecipientAccount(
      () => supertest(server) as unknown as TestClient,
    );
    recipientAccountId = seed.accountId;
  });

  afterAll(async () => {
    await app.close();
    delete process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY;
  });

  it('registers, logs in, transfers, and lists transactions', async () => {
    const client = (): TestClient => supertest(server) as unknown as TestClient;

    const email = `user-${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Happy Path User';

    const registerBody = { email, password, fullName };
    const { request: registerRequest } = applySecurity(
      client().post('/auth/register'),
      'POST',
      '/auth/register',
      registerBody,
    );

    const registerResponse = await registerRequest.send(registerBody).expect(201);
    const registerPayload = getResponseBody<{
      token?: string;
      account?: { id?: string };
    }>(registerResponse);

    const token = registerPayload.token;
    const accountId = registerPayload.account?.id;
    expect(token).toBeTruthy();
    expect(accountId).toBeTruthy();

    const loginBody = { email, password };
    const { request: loginRequest } = applySecurity(
      client().post('/auth/login'),
      'POST',
      '/auth/login',
      loginBody,
    );

    const loginResponse = await loginRequest.send(loginBody);
    expect([200, 201]).toContain(loginResponse.status);
    const loginPayload = getResponseBody<{ token?: string }>(loginResponse);
    expect(loginPayload.token).toBeTruthy();

    const balanceResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const balancePayload = getResponseBody<{
      total?: { value?: string };
    }>(balanceResponse);
    expect(balancePayload.total?.value).toBe('1000.00');

    const transferAmount = '50.00';
    const transferBody = {
      sourceAccountId: accountId,
      destinationAccountId: recipientAccountId,
      amount: { currency: 'QZD', value: transferAmount },
      memo: 'Happy path transfer',
    } as const;

    const { request: transferRequest } = applySecurity(
      client().post('/tx/transfer'),
      'POST',
      '/tx/transfer',
      transferBody,
    );

    const transferResponse = await transferRequest
      .set('Authorization', `Bearer ${token}`)
      .send(transferBody)
      .expect(201);

    const transferPayload = getResponseBody<{
      id?: string;
      status?: string;
      amount?: { value?: string };
    }>(transferResponse);
    expect(transferPayload.id).toBeTruthy();
    expect(transferPayload.status).toBe('posted');
    expect(transferPayload.amount?.value).toBe(transferAmount);

    const postTransferBalanceResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const postTransferBalance = getResponseBody<{
      total?: { value?: string };
    }>(postTransferBalanceResponse);
    expect(postTransferBalance.total?.value).toBe('950.00');

    const transactionsResponse = await client()
      .get(`/accounts/${accountId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const transactionsPayload = getResponseBody<{
      items?: Array<{
        type?: string;
        amount?: { value?: string };
        metadata?: Record<string, string>;
      }>;
    }>(transactionsResponse);

    const items = transactionsPayload.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.type).toBe('transfer');
    expect(items[0]?.amount?.value).toBe(transferAmount);
    expect(items[0]?.metadata?.direction).toBe('outgoing');
  });
});
