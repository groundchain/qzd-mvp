import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

async function run() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const server = app.getHttpServer();

  const register = await request(server)
    .post('/auth/register')
    .send({ channel: 'phone', phoneNumber: '+50212345678', otpCode: '123456' });
  assert.equal(register.status, 202);
  assert.ok(register.body.registrationId);
  assert.ok(register.body.expiresAt);

  const login = await request(server)
    .post('/auth/login')
    .send({ identifier: '+50212345678', otpCode: '123456' });
  assert.equal(login.status, 200);
  assert.ok(login.body.accessToken);
  assert.ok(login.body.refreshToken);

  const ownerId = '00000000-0000-0000-0000-000000000123';
  const createAccount = await request(server)
    .post('/accounts')
    .send({ ownerId, currency: 'QZD' });
  assert.equal(createAccount.status, 201);
  assert.ok(createAccount.body.id);
  const accountId = createAccount.body.id;

  const balance = await request(server).get(`/accounts/${accountId}/balance`);
  assert.equal(balance.status, 200);
  assert.equal(balance.body.accountId, accountId);
  assert.equal(balance.body.currency, 'QZD');

  const history = await request(server).get(`/accounts/${accountId}/history`);
  assert.equal(history.status, 200);
  assert.equal(history.body.accountId, accountId);
  assert.ok(Array.isArray(history.body.items));

  const transfer = await request(server)
    .post('/tx/transfer')
    .send({
      fromAccountId: accountId,
      toAccountId: '00000000-0000-0000-0000-000000000999',
      amount: '25.00'
    });
  assert.equal(transfer.status, 202);
  assert.equal(transfer.body.status, 'accepted');

  const issue = await request(server)
    .post('/tx/issue')
    .send({
      mintToAccountId: accountId,
      amount: '100.00',
      approvals: [
        {
          adminId: '00000000-0000-0000-0000-000000000001',
          signature: 'a'.repeat(64)
        }
      ]
    });
  assert.equal(issue.status, 202);
  assert.ok(issue.body.submissionId);

  const redeem = await request(server)
    .post('/tx/redeem')
    .send({
      fromAccountId: accountId,
      amount: '12.50',
      destination: {
        type: 'bank_transfer',
        bankAccount: {
          routingNumber: '123456789',
          accountNumber: '9876543210'
        }
      }
    });
  assert.equal(redeem.status, 202);

  const remit = await request(server)
    .post('/remit/us/acquire-qzd')
    .send({
      usdAmount: '150.00',
      beneficiaryAccountId: accountId,
      senderName: 'Alice'
    });
  assert.equal(remit.status, 202);
  assert.ok(remit.body.remittanceId);

  const live = await request(server).get('/health/live');
  assert.equal(live.status, 200);
  assert.equal(live.body.status, 'ok');

  const ready = await request(server).get('/health/ready');
  assert.equal(ready.status, 200);
  assert.equal(ready.body.status, 'ok');

  const validators = await request(server).get('/validators');
  assert.equal(validators.status, 200);
  assert.ok(Array.isArray(validators.body.items));

  const sign = await request(server)
    .post('/validators/sign')
    .send({
      validatorId: '00000000-0000-0000-0000-000000000001',
      payload: 'YWFhYWFhYWFhYWFhYWFhYQ=='
    });
  assert.equal(sign.status, 200);
  assert.ok(sign.body.signature);

  await app.close();
  await moduleRef.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
