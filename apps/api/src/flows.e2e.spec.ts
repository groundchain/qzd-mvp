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
});
