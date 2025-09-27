import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';

describe('Wallet flows', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, loads balance, sends transfer, and lists transactions', async () => {
    const email = `user${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Test User';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = () => supertest(server) as any;

    const registerResponse = await client()
      .post('/auth/register')
      .send({ email, password, fullName })
      .expect(201);

    const token = registerResponse.body.token as string;
    expect(token).toBeTruthy();
    const accountId = registerResponse.body.account?.id as string;
    expect(accountId).toBeTruthy();

    const loginResponse = await client()
      .post('/auth/login')
      .send({ email, password });
    expect([200, 201]).toContain(loginResponse.status);
    expect(loginResponse.body.token).toBeTruthy();

    const balanceResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(balanceResponse.body.accountId).toBe(accountId);

    const transferResponse = await client()
      .post('/tx/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAccountId: accountId,
        destinationAccountId: `${accountId}-dest`,
        amount: { currency: 'QZD', value: '10.00' },
      })
      .expect(201);

    expect(transferResponse.body.id).toBeTruthy();

    const transactionsResponse = await client()
      .get(`/accounts/${accountId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(transactionsResponse.body.items)).toBe(true);
    expect(transactionsResponse.body.items.length).toBeGreaterThan(0);
  });

  it('supports agent cash-in, cash-out, and voucher redemption flows', async () => {
    const email = `agent${Date.now()}@example.com`;
    const password = 'Pass1234!';
    const fullName = 'Agent User';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = () => supertest(server) as any;

    const registerResponse = await client()
      .post('/auth/register')
      .send({ email, password, fullName })
      .expect(201);

    const token = registerResponse.body.token as string;
    const accountId = registerResponse.body.account?.id as string;

    const balanceResponse = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const startingBalance = Number.parseFloat(balanceResponse.body.total.value as string);

    const cashInResponse = await client()
      .post('/agents/cashin')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: { currency: 'QZD', value: '200.00' },
        memo: 'Float top-up',
      })
      .expect(201);

    expect(cashInResponse.body.type).toBe('credit');

    const postCashInBalance = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const balanceAfterCashIn = Number.parseFloat(postCashInBalance.body.total.value as string);
    expect(balanceAfterCashIn).toBeCloseTo(startingBalance + 200, 2);

    const cashOutResponse = await client()
      .post('/agents/cashout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amount: { currency: 'QZD', value: '100.00' },
        memo: 'Branch disbursement',
      })
      .expect(201);

    const voucherCode = cashOutResponse.body.code as string;
    expect(voucherCode).toMatch(/^vch_/);
    expect(cashOutResponse.body.fee.value).toBe('0.50');

    const postCashOutBalance = await client()
      .get(`/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const balanceAfterCashOut = Number.parseFloat(postCashOutBalance.body.total.value as string);
    expect(balanceAfterCashOut).toBeCloseTo(balanceAfterCashIn - 100.5, 2);

    const redeemResponse = await client()
      .post(`/agents/vouchers/${voucherCode}/redeem`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(redeemResponse.body.status).toBe('redeemed');
    expect(redeemResponse.body.code).toBe(voucherCode);

    const transactionsResponse = await client()
      .get(`/accounts/${accountId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const items = transactionsResponse.body.items as Array<{ type: string; metadata?: Record<string, string> }>;
    expect(items[0]?.type).toBe('redemption');
    expect(items[0]?.metadata?.voucherCode).toBe(voucherCode);
    expect(items[1]?.metadata?.feeValue).toBe('0.50');
  });
});
