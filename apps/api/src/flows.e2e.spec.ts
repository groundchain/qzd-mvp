import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bytesToHex } from '@noble/curves/abstract/utils';
import { AppModule } from './app.module.js';
import { InMemoryBankService, getFallbackBankService } from './in-memory-bank.service.js';
import { createMockCardKeys, createOfflineVoucher } from '@qzd/card-mock';
import {
  DEV_SIGNING_PUBLIC_KEY_HEX,
  applySecurity,
  createTestClient,
  extractErrorDetails,
  getResponseBody,
  type ErrorPayload,
  type SecurityOverrides,
  type TestClient,
} from './test-helpers/e2e-utils.js';

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
    const client = (): TestClient => createTestClient(server);

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
    const client = (): TestClient => createTestClient(server);

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
    const balanceAfterCashOut = Number.parseFloat(
      (postCashOutPayload.total?.value as string) ?? '0',
    );
    expect(balanceAfterCashOut).toBeCloseTo(balanceAfterCashIn - 100.5, 2);

    const redeemPath = `/agents/vouchers/${voucherCode}/redeem`;
    const { request: redeemRequest } = applySecurity(
      client().post(redeemPath),
      'POST',
      redeemPath,
      null,
    );
    const redeemResponse = await redeemRequest.set('Authorization', `Bearer ${token}`).expect(201);

    const redeemPayload = getResponseBody<{ status?: string; code?: string }>(redeemResponse);
    expect(redeemPayload.status).toBe('redeemed');
    expect(redeemPayload.code).toBe(voucherCode);

    const transactionsResponse = await client()
      .get(`/accounts/${accountId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const transactionsPayload = getResponseBody<{ items?: unknown[] }>(transactionsResponse);
    const items =
      (transactionsPayload.items as Array<{ type: string; metadata?: Record<string, string> }>) ??
      [];
    expect(items[0]?.type).toBe('redemption');
    expect(items[0]?.metadata?.voucherCode).toBe(voucherCode);
    expect(items[1]?.metadata?.feeValue).toBe('0.50');
  });

  it('processes offline vouchers and blocks replayed redemption', async () => {
    const email = `offline${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Offline User';
    const client = (): TestClient => createTestClient(server);

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
    expect(token).toBeTruthy();
    expect(accountId).toBeTruthy();

    const card = createMockCardKeys('card-offline-1');
    bank.registerOfflineCard(card.id, card.publicKeyHex);

    const voucherDraft = {
      id: `ovch_${Date.now()}`,
      fromCardId: card.id,
      toAccountId: accountId,
      amount: { currency: 'QZD', value: '15.00' },
      nonce: `nonce-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    } as const;
    const signedVoucher = createOfflineVoucher(voucherDraft, card.privateKeyHex);

    const { request: createVoucherRequest } = applySecurity(
      client().post('/offline/vouchers'),
      'POST',
      '/offline/vouchers',
      signedVoucher,
    );
    const createVoucherResponse = await createVoucherRequest
      .set('Authorization', `Bearer ${token}`)
      .send(signedVoucher)
      .expect(201);
    const createVoucherPayload = getResponseBody<{ id?: string; status?: string }>(
      createVoucherResponse,
    );
    expect(createVoucherPayload.id).toBe(voucherDraft.id);
    expect(createVoucherPayload.status).toBe('pending');

    const { request: duplicateRequest } = applySecurity(
      client().post('/offline/vouchers'),
      'POST',
      '/offline/vouchers',
      signedVoucher,
    );
    await duplicateRequest.set('Authorization', `Bearer ${token}`).send(signedVoucher).expect(409);

    const redeemPath = `/offline/vouchers/${voucherDraft.id}/redeem`;
    const { request: redeemRequest } = applySecurity(
      client().post(redeemPath),
      'POST',
      redeemPath,
      null,
    );
    const redeemResponse = await redeemRequest.set('Authorization', `Bearer ${token}`).expect(201);
    const redeemPayload = getResponseBody<{ status?: string; id?: string }>(redeemResponse);
    expect(redeemPayload.status).toBe('redeemed');
    expect(redeemPayload.id).toBe(voucherDraft.id);

    const { request: replayRedeemRequest } = applySecurity(
      client().post(redeemPath),
      'POST',
      redeemPath,
      null,
    );
    await replayRedeemRequest.set('Authorization', `Bearer ${token}`).expect(409);
  });

  it('rejects replayed requests with the same nonce', async () => {
    const email = `replay${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Replay User';
    const client = (): TestClient => createTestClient(server);

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

    const replayPayload = getResponseBody<ErrorPayload>(replayResponse);
    const { code: replayCode, message: replayMessage } = extractErrorDetails(replayPayload);
    expect(replayCode).toBe('REPLAY_DETECTED');
    expect(replayMessage).toBe('Nonce has already been used.');
  });

  it('returns the documented response when a registration is retried with the same payload', async () => {
    const email = `idem-register${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Idempotent Register';
    const client = (): TestClient => createTestClient(server);

    const registerBody = { email, password, fullName };
    const { request: firstRequest, headers } = applySecurity(
      client().post('/auth/register'),
      'POST',
      '/auth/register',
      registerBody,
    );
    const firstResponse = await firstRequest.send(registerBody).expect(201);
    const firstPayload = getResponseBody<{
      token?: string;
      account?: { id?: string };
    }>(firstResponse);

    const { request: retryRequest } = applySecurity(
      client().post('/auth/register'),
      'POST',
      '/auth/register',
      registerBody,
      { idempotencyKey: headers.idempotencyKey },
    );
    const retryResponse = await retryRequest.send(registerBody).expect(201);
    const retryPayload = getResponseBody<{
      token?: string;
      account?: { id?: string };
    }>(retryResponse);

    expect(retryPayload).toStrictEqual(firstPayload);
  });

  it('returns a conflict when the same idempotency key is reused with a different payload', async () => {
    const email = `conflict${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Conflict User';
    const client = (): TestClient => createTestClient(server);

    const registerBody = { email, password, fullName };
    const { request: registerRequest, headers } = applySecurity(
      client().post('/auth/register'),
      'POST',
      '/auth/register',
      registerBody,
    );
    await registerRequest.send(registerBody).expect(201);

    const conflictingBody = { ...registerBody, fullName: 'Changed Name' };
    const { request: conflictRequest } = applySecurity(
      client().post('/auth/register'),
      'POST',
      '/auth/register',
      conflictingBody,
      { idempotencyKey: headers.idempotencyKey },
    );
    const conflictResponse = await conflictRequest.send(conflictingBody).expect(409);
    const conflictPayload = getResponseBody<ErrorPayload>(conflictResponse);
    const { code: conflictCode, message: conflictMessage } = extractErrorDetails(conflictPayload);

    expect(conflictCode).toBe('CONFLICT');
    expect(conflictMessage).toBe('Idempotency key has already been used with a different payload.');
  });

  it('rejects registration replays that reuse the same nonce', async () => {
    const email = `nonce${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Nonce Replay';
    const client = (): TestClient => createTestClient(server);

    const registerBody = { email, password, fullName };
    const overrides: SecurityOverrides = {
      idempotencyKey: `idem-${randomUUID()}`,
      nonce: bytesToHex(randomBytes(16)),
    };

    const { request: firstRequest } = applySecurity(
      client().post('/auth/register'),
      'POST',
      '/auth/register',
      registerBody,
      overrides,
    );
    await firstRequest.send(registerBody).expect(201);

    const { request: replayRequest } = applySecurity(
      client().post('/auth/register'),
      'POST',
      '/auth/register',
      registerBody,
      overrides,
    );
    const replayResponse = await replayRequest.send(registerBody).expect(409);
    const replayPayload = getResponseBody<ErrorPayload>(replayResponse);
    const { code: replayCode, message: replayMessage } = extractErrorDetails(replayPayload);

    expect(replayCode).toBe('REPLAY_DETECTED');
    expect(replayMessage).toBe('Nonce has already been used.');
  });

  it('returns the same result for idempotent retries', async () => {
    const email = `idem${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Idem User';
    const client = (): TestClient => createTestClient(server);

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
    const finalBalancePayload = getResponseBody<{ total?: { value?: string } }>(
      finalBalanceResponse,
    );
    const finalTotal = Number.parseFloat((finalBalancePayload.total?.value as string) ?? '0');

    expect(finalTotal - startingTotal).toBeCloseTo(75, 2);
  });

  it('ensures cash-in retries remain idempotent after a simulated crash', async () => {
    const email = `crash${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Crash Test User';
    const client = (): TestClient => createTestClient(server);

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
    await firstRequest.set('Authorization', `Bearer ${token}`).send(cashInBody).expect(500);

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
    const finalBalancePayload = getResponseBody<{ total?: { value?: string } }>(
      finalBalanceResponse,
    );
    const finalTotal = Number.parseFloat((finalBalancePayload.total?.value as string) ?? '0');

    expect(finalTotal - startingTotal).toBeCloseTo(25, 2);
  });

  it('drains the dead-letter queue when the retry worker runs', async () => {
    const email = `worker${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Retry Worker User';
    const client = (): TestClient => createTestClient(server);

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
    await firstRequest.set('Authorization', `Bearer ${token}`).send(cashInBody).expect(500);

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
