import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import {
  InMemoryBankService,
  getFallbackBankService,
  resetFallbackBankService,
} from './in-memory-bank.service.js';
import {
  DEV_SIGNING_PUBLIC_KEY_HEX,
  applySecurity,
  createTestClient,
  getResponseBody,
  type TestClient,
} from './test-helpers/request-security.js';

type InternalAccountRecord = {
  id: string;
  balance: number;
  openingBalance: number;
  currency: string;
};

type InternalTransactionRecord = {
  id?: string;
  type?: string;
  amount?: { value?: string; currency?: string };
  metadata?: Record<string, string>;
};

type BankInternals = {
  accounts: Map<string, InternalAccountRecord>;
  transactions: Map<string, InternalTransactionRecord[]>;
  computeAccountBalanceFromHistory(account: InternalAccountRecord): number;
};

describe('Admin issuance approvals', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let bank: InMemoryBankService;

  beforeAll(async () => {
    process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY = DEV_SIGNING_PUBLIC_KEY_HEX;
    resetFallbackBankService();

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

  it('processes a multi-signature issuance and preserves ledger invariants', async () => {
    const client = (): TestClient => createTestClient(server);
    const email = `treasury${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Treasury Operator';

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

    const balanceResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const balancePayload = getResponseBody<{ total?: { value?: string } }>(balanceResponse);
    const startingBalance = Number.parseFloat(balancePayload.total?.value ?? '0');

    const bankInternals = bank as unknown as BankInternals;
    const initialAccountRecord = bankInternals.accounts.get(accountId);
    expect(initialAccountRecord).toBeDefined();
    const totalBeforeIssuance = Array.from(bankInternals.accounts.values()).reduce(
      (sum, record) => sum + record.balance,
      0,
    );

    const issuanceAmountValue = '250.00';
    const createIssuanceBody = {
      accountId,
      amount: { currency: 'QZD', value: issuanceAmountValue },
      reference: 'Treasury top-up',
    } as const;
    const { request: createIssuanceRequest } = applySecurity(
      client().post('/admin/issuance-requests'),
      'POST',
      '/admin/issuance-requests',
      createIssuanceBody,
    );
    const issuanceResponse = await createIssuanceRequest
      .set('Authorization', `Bearer ${token}`)
      .send(createIssuanceBody)
      .expect(201);
    const issuancePayload = getResponseBody<{
      id?: string;
      status?: string;
      required?: number;
      collected?: number;
    }>(issuanceResponse);

    const issuanceId = issuancePayload.id as string;
    expect(issuanceId).toMatch(/^ir_/);
    expect(issuancePayload.required).toBe(2);
    expect(issuancePayload.status).toBe('pending');
    expect(issuancePayload.collected).toBe(0);

    const firstSignatureBody = { validatorId: 'validator-1' } as const;
    const firstSignaturePath = `/admin/issuance-requests/${issuanceId}/sign`;
    const { request: firstSignatureRequest } = applySecurity(
      client().post(firstSignaturePath),
      'POST',
      firstSignaturePath,
      firstSignatureBody,
    );
    const firstSignatureResponse = await firstSignatureRequest
      .set('Authorization', `Bearer ${token}`)
      .send(firstSignatureBody);
    expect([200, 201]).toContain(firstSignatureResponse.status);
    const firstSignaturePayload = getResponseBody<{ collected?: number; status?: string }>(
      firstSignatureResponse,
    );
    expect(firstSignaturePayload.collected).toBe(1);
    expect(firstSignaturePayload.status).toBe('collecting');

    const secondSignatureBody = { validatorId: 'validator-2' } as const;
    const { request: secondSignatureRequest } = applySecurity(
      client().post(firstSignaturePath),
      'POST',
      firstSignaturePath,
      secondSignatureBody,
    );
    const secondSignatureResponse = await secondSignatureRequest
      .set('Authorization', `Bearer ${token}`)
      .send(secondSignatureBody);
    expect([200, 201]).toContain(secondSignatureResponse.status);
    const secondSignaturePayload = getResponseBody<{ collected?: number; status?: string }>(
      secondSignatureResponse,
    );
    expect(secondSignaturePayload.collected).toBe(2);
    expect(secondSignaturePayload.status).toBe('ready');

    const finalizeBody = { requestId: issuanceId } as const;
    const { request: finalizeRequest } = applySecurity(
      client().post('/tx/issue'),
      'POST',
      '/tx/issue',
      finalizeBody,
    );
    const finalizeResponse = await finalizeRequest
      .set('Authorization', `Bearer ${token}`)
      .send(finalizeBody);
    expect([200, 201]).toContain(finalizeResponse.status);
    const finalizePayload = getResponseBody<{
      id?: string;
      type?: string;
      amount?: { value?: string };
      metadata?: Record<string, string>;
    }>(finalizeResponse);

    expect(finalizePayload.type).toBe('issuance');
    expect(finalizePayload.metadata?.requestId).toBe(issuanceId);
    const mintedAmount = Number.parseFloat(finalizePayload.amount?.value ?? '0');
    expect(mintedAmount).toBeCloseTo(Number.parseFloat(issuanceAmountValue), 2);

    const balanceAfterResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const balanceAfterPayload = getResponseBody<{ total?: { value?: string } }>(
      balanceAfterResponse,
    );
    const balanceAfter = Number.parseFloat(balanceAfterPayload.total?.value ?? '0');
    expect(balanceAfter).toBeCloseTo(startingBalance + mintedAmount, 2);

    const totalAfterIssuance = Array.from(bankInternals.accounts.values()).reduce(
      (sum, record) => sum + record.balance,
      0,
    );
    expect(totalAfterIssuance).toBeCloseTo(totalBeforeIssuance + mintedAmount, 2);

    const updatedAccountRecord = bankInternals.accounts.get(accountId);
    expect(updatedAccountRecord).toBeDefined();
    const computeAccountBalanceFromHistory =
      bankInternals.computeAccountBalanceFromHistory.bind(bankInternals);
    const recomputedBalance = computeAccountBalanceFromHistory(updatedAccountRecord!);
    expect(recomputedBalance).toBeCloseTo(updatedAccountRecord!.balance, 2);

    const history = bankInternals.transactions.get(accountId) ?? [];
    expect(history[0]?.type).toBe('issuance');
    expect(history[0]?.metadata?.requestId).toBe(issuanceId);
  });
});
