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

  const register = await (request(server) as any)
    .post('/auth/register')
    .send({ phone: '50212345678', dpi: '1234567890101', otpChannel: 'sms' });
  assert.equal(register.status, 201);
  assert.ok(register.body.accountId);

  const login = await (request(server) as any)
    .post('/auth/login')
    .send({ phone: '50212345678', otp: '123456' });
  assert.equal(login.status, 200);
  assert.ok(login.body.accessToken);

  const account = await (request(server) as any)
    .post('/accounts')
    .send({ phone: '50212345679', dpi: '1234567890102', displayName: 'Test User' });
  assert.equal(account.status, 201);
  assert.ok(account.body.accountId);

  const transfer = await (request(server) as any)
    .post('/tx/transfer')
    .send({
      fromAccountId: '00000000-0000-0000-0000-000000000001',
      toAccountId: '00000000-0000-0000-0000-000000000002',
      amount: 25,
      memo: 'Test transfer'
    });
  assert.equal(transfer.status, 201);

  const issue = await (request(server) as any)
    .post('/tx/issue')
    .send({
      toAccountId: '00000000-0000-0000-0000-000000000003',
      amount: 100,
      approvals: [
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002'
      ]
    });
  assert.equal(issue.status, 201);

  const redeem = await (request(server) as any)
    .post('/tx/redeem')
    .send({ accountId: '00000000-0000-0000-0000-000000000003', amount: 12.5 });
  assert.equal(redeem.status, 201);

  const remit = await (request(server) as any)
    .post('/remit/us/acquire-qzd')
    .send({
      senderName: 'Alice',
      amountUsd: 150,
      destinationAccountId: '00000000-0000-0000-0000-000000000001'
    });
  assert.equal(remit.status, 201);

  const health = await (request(server) as any).get('/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');

  const validators = await (request(server) as any).get('/validators');
  assert.equal(validators.status, 200);
  assert.ok(Array.isArray(validators.body));

  const sign = await (request(server) as any)
    .post('/validators/sign')
    .send({
      validatorId: '00000000-0000-0000-0000-000000000001',
      payload: 'hello world'
    });
  assert.equal(sign.status, 201);
  assert.ok(sign.body.signature);

  await app.close();
  await moduleRef.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
