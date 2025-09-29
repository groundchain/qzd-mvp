import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { AppModule } from './app.module.js';
import { InMemoryBankService, getFallbackBankService } from './in-memory-bank.service.js';
import { createSignaturePayload, serializeBody } from './request-security.js';

const DEV_SIGNING_PRIVATE_KEY_HEX =
  '0a3c8c97f7925ea37e46f69af43e219b1d09de89ec1a76cf2ce9a9289a392d5a';
const DEV_SIGNING_PUBLIC_KEY_HEX = bytesToHex(
  ed25519.getPublicKey(hexToBytes(DEV_SIGNING_PRIVATE_KEY_HEX)),
);

type SecurityOverrides = {
  idempotencyKey?: string;
  nonce?: string;
};

interface SecurityHeaders {
  idempotencyKey: string;
  nonce: string;
  signature: string;
}

function buildSecurityHeaders(
  method: string,
  path: string,
  body: unknown,
  overrides: SecurityOverrides = {},
): SecurityHeaders {
  const idempotencyKey = overrides.idempotencyKey ?? `idem-${randomUUID()}`;
  const nonce = overrides.nonce ?? bytesToHex(randomBytes(16));
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

function getResponseBody<T extends Record<string, unknown>>(response: ResponseWithBody): T {
  return response.body as T;
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

describe('Wallet flows', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let bank: InMemoryBankService;

  beforeAll(async () => {
    process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY = DEV_SIGNING_PUBLIC_KEY_HEX;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    bank = getFallbackBankService();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY;
  });

  it('registers, logs in, loads balance, sends transfer, and lists transactions', async () => {
    const email = `user${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Test User';
    const client = (): TestClient => supertest(server) as unknown as TestClient;

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

    const token = registerPayload.token as string;
    expect(token).toBeTruthy();
    const accountId = registerPayload.account?.id as string;
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

    const balancePayload = getResponseBody<{ accountId?: string }>(balanceResponse);
    expect(balancePayload.accountId).toBe(accountId);

    const transferBody = {
      sourceAccountId: accountId,
      destinationAccountId: `${accountId}-dest`,
      amount: { currency: 'QZD', value: '10.00' },
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

    const transferPayload = getResponseBody<{ id?: string }>(transferResponse);
    expect(transferPayload.id).toBeTruthy();

    const transactionsResponse = await client()
      .get(`/accounts/${accountId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const transactionsPayload = getResponseBody<{ items?: unknown[] }>(transactionsResponse);
    expect(Array.isArray(transactionsPayload.items)).toBe(true);
    expect((transactionsPayload.items ?? []).length).toBeGreaterThan(0);
  });

  it('supports agent cash-in, cash-out, and voucher redemption flows', async () => {
    const email = `agent${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Agent User';
    const client = (): TestClient => supertest(server) as unknown as TestClient;

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

    const token = registerPayload.token as string;
    const accountId = registerPayload.account?.id as string;

    const balanceResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const balancePayload = getResponseBody<{ total?: { value?: string } }>(balanceResponse);
    const startingBalance = Number.parseFloat((balancePayload.total?.value as string) ?? '0');

    const cashInBody = {
      accountId,
      amount: { currency: 'QZD', value: '200.00' },
      memo: 'Float top-up',
    } as const;
    const { request: cashInRequest } = applySecurity(
      client().post('/agents/cashin'),
      'POST',
      '/agents/cashin',
      cashInBody,
    );
    const cashInResponse = await cashInRequest
      .set('Authorization', `Bearer ${token}`)
      .send(cashInBody)
      .expect(201);

    const cashInPayload = getResponseBody<{ type?: string }>(cashInResponse);
    expect(cashInPayload.type).toBe('credit');

    const postCashInBalance = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const postCashInPayload = getResponseBody<{ total?: { value?: string } }>(postCashInBalance);
    const balanceAfterCashIn = Number.parseFloat((postCashInPayload.total?.value as string) ?? '0');
    expect(balanceAfterCashIn).toBeCloseTo(startingBalance + 200, 2);

    const cashOutBody = {
      accountId,
      amount: { currency: 'QZD', value: '100.00' },
      memo: 'Branch disbursement',
    } as const;
    const { request: cashOutRequest } = applySecurity(
      client().post('/agents/cashout'),
      'POST',
      '/agents/cashout',
      cashOutBody,
    );
    const cashOutResponse = await cashOutRequest
      .set('Authorization', `Bearer ${token}`)
      .send(cashOutBody)
      .expect(201);

    const cashOutPayload = getResponseBody<{
      code?: string;
      fee?: { value?: string };
    }>(cashOutResponse);
    const voucherCode = cashOutPayload.code as string;
    expect(voucherCode).toMatch(/^vch_/);
    expect(cashOutPayload.fee?.value).toBe('0.50');

    const postCashOutBalance = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const postCashOutPayload = getResponseBody<{ total?: { value?: string } }>(postCashOutBalance);
    const balanceAfterCashOut = Number.parseFloat((postCashOutPayload.total?.value as string) ?? '0');
    expect(balanceAfterCashOut).toBeCloseTo(balanceAfterCashIn - 100.5, 2);

    const redeemPath = `/agents/vouchers/${voucherCode}/redeem`;
    const { request: redeemRequest } = applySecurity(
      client().post(redeemPath),
      'POST',
      redeemPath,
      null,
    );
    const redeemResponse = await redeemRequest
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const redeemPayload = getResponseBody<{ status?: string; code?: string }>(redeemResponse);
    expect(redeemPayload.status).toBe('redeemed');
    expect(redeemPayload.code).toBe(voucherCode);

    const transactionsResponse = await client()
      .get(`/accounts/${accountId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const transactionsPayload = getResponseBody<{ items?: unknown[] }>(transactionsResponse);
    const items = (transactionsPayload.items as Array<{ type: string; metadata?: Record<string, string> }>) ?? [];
    expect(items[0]?.type).toBe('redemption');
    expect(items[0]?.metadata?.voucherCode).toBe(voucherCode);
    expect(items[1]?.metadata?.feeValue).toBe('0.50');
  });

  it('rejects replayed requests with the same nonce', async () => {
    const email = `replay${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Replay User';
    const client = (): TestClient => supertest(server) as unknown as TestClient;

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

    const token = registerPayload.token as string;
    const accountId = registerPayload.account?.id as string;

    const cashInBody = {
      accountId,
      amount: { currency: 'QZD', value: '50.00' },
      memo: 'Replay check',
    } as const;
    const overrides: SecurityOverrides = {
      idempotencyKey: `idem-${randomUUID()}`,
      nonce: bytesToHex(randomBytes(16)),
    };

    const { request: firstRequest } = applySecurity(
      client().post('/agents/cashin'),
      'POST',
      '/agents/cashin',
      cashInBody,
      overrides,
    );
    await firstRequest.set('Authorization', `Bearer ${token}`).send(cashInBody).expect(201);

    const { request: replayRequest } = applySecurity(
      client().post('/agents/cashin'),
      'POST',
      '/agents/cashin',
      cashInBody,
      overrides,
    );
    const replayResponse = await replayRequest
      .set('Authorization', `Bearer ${token}`)
      .send(cashInBody)
      .expect(409);

    const replayPayload = getResponseBody<{
      code?: string;
      message?: { code?: string };
    }>(replayResponse);
    expect(replayPayload.message?.code ?? replayPayload.code).toBe('REPLAY_DETECTED');
  });

  it('returns the same result for idempotent retries', async () => {
    const email = `idem${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Idem User';
    const client = (): TestClient => supertest(server) as unknown as TestClient;

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

    const token = registerPayload.token as string;
    const accountId = registerPayload.account?.id as string;

    const startingBalanceResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const startingBalancePayload = getResponseBody<{ total?: { value?: string } }>(startingBalanceResponse);
    const startingTotal = Number.parseFloat((startingBalancePayload.total?.value as string) ?? '0');

    const cashInBody = {
      accountId,
      amount: { currency: 'QZD', value: '75.00' },
      memo: 'Idempotency test',
    } as const;
    const idempotencyKey = `idem-${randomUUID()}`;

    const { request: firstRequest } = applySecurity(
      client().post('/agents/cashin'),
      'POST',
      '/agents/cashin',
      cashInBody,
      { idempotencyKey },
    );
    const firstResponse = await firstRequest
      .set('Authorization', `Bearer ${token}`)
      .send(cashInBody)
      .expect(201);
    const firstPayload = getResponseBody<{ id?: string }>(firstResponse);

    const { request: retryRequest } = applySecurity(
      client().post('/agents/cashin'),
      'POST',
      '/agents/cashin',
      cashInBody,
      { idempotencyKey },
    );
    const retryResponse = await retryRequest
      .set('Authorization', `Bearer ${token}`)
      .send(cashInBody)
      .expect(201);
    const retryPayload = getResponseBody<{ id?: string }>(retryResponse);

    expect(retryPayload.id).toBe(firstPayload.id);

    const finalBalanceResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const finalBalancePayload = getResponseBody<{ total?: { value?: string } }>(finalBalanceResponse);
    const finalTotal = Number.parseFloat((finalBalancePayload.total?.value as string) ?? '0');

    expect(finalTotal - startingTotal).toBeCloseTo(75, 2);
  });

  it('ensures cash-in retries remain idempotent after a simulated crash', async () => {
    const email = `crash${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Crash Test User';
    const client = (): TestClient => supertest(server) as unknown as TestClient;

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

    const token = registerPayload.token as string;
    const accountId = registerPayload.account?.id as string;

    const startingBalanceResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const startingBalancePayload = getResponseBody<{ total?: { value?: string } }>(
      startingBalanceResponse,
    );
    const startingTotal = Number.parseFloat((startingBalancePayload.total?.value as string) ?? '0');

    const cashInBody = {
      accountId,
      amount: { currency: 'QZD', value: '25.00' },
      memo: 'Crash retry',
    } as const;

    const idempotencyKey = `idem-${randomUUID()}`;

    bank.simulateCrashOnNextTransaction();

    const { request: firstRequest } = applySecurity(
      client().post('/agents/cashin'),
      'POST',
      '/agents/cashin',
      cashInBody,
      { idempotencyKey },
    );
    await firstRequest
      .set('Authorization', `Bearer ${token}`)
      .send(cashInBody)
      .expect(500);

    const dlqAfterCrash = bank.getDeadLetterQueueSnapshot();
    expect(dlqAfterCrash).toHaveLength(1);
    expect(dlqAfterCrash[0]?.jobKind).toBe('agent_cash_in');

    const { request: retryRequest } = applySecurity(
      client().post('/agents/cashin'),
      'POST',
      '/agents/cashin',
      cashInBody,
      { idempotencyKey },
    );
    const retryResponse = await retryRequest
      .set('Authorization', `Bearer ${token}`)
      .send(cashInBody)
      .expect(201);
    const retryPayload = getResponseBody<{ id?: string }>(retryResponse);
    expect(retryPayload.id).toBeTruthy();

    const dlqAfterRetry = bank.getDeadLetterQueueSnapshot();
    expect(dlqAfterRetry).toHaveLength(0);

    const finalBalanceResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const finalBalancePayload = getResponseBody<{ total?: { value?: string } }>(finalBalanceResponse);
    const finalTotal = Number.parseFloat((finalBalancePayload.total?.value as string) ?? '0');

    expect(finalTotal - startingTotal).toBeCloseTo(25, 2);
  });

  it('drains the dead-letter queue when the retry worker runs', async () => {
    const email = `worker${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Retry Worker User';
    const client = (): TestClient => supertest(server) as unknown as TestClient;

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

    const token = registerPayload.token as string;
    const accountId = registerPayload.account?.id as string;

    const cashInBody = {
      accountId,
      amount: { currency: 'QZD', value: '15.00' },
      memo: 'Worker retry',
    } as const;
    const idempotencyKey = `idem-${randomUUID()}`;

    bank.simulateCrashOnNextTransaction();

    const { request: firstRequest } = applySecurity(
      client().post('/agents/cashin'),
      'POST',
      '/agents/cashin',
      cashInBody,
      { idempotencyKey },
    );
    await firstRequest
      .set('Authorization', `Bearer ${token}`)
      .send(cashInBody)
      .expect(500);

    expect(bank.getDeadLetterQueueSnapshot()).toHaveLength(1);

    bank.retryFailedTransactions();

    expect(bank.getDeadLetterQueueSnapshot()).toHaveLength(0);

    const { request: confirmRequest } = applySecurity(
      client().post('/agents/cashin'),
      'POST',
      '/agents/cashin',
      cashInBody,
      { idempotencyKey },
    );
    const confirmResponse = await confirmRequest
      .set('Authorization', `Bearer ${token}`)
      .send(cashInBody)
      .expect(201);
    const confirmPayload = getResponseBody<{ id?: string }>(confirmResponse);
    expect(confirmPayload.id).toBeTruthy();
  });
});
