import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { AppModule } from './app.module.js';
import { createSignaturePayload, serializeBody } from './request-security.js';

const DEV_SIGNING_PRIVATE_KEY_HEX =
  '0a3c8c97f7925ea37e46f69af43e219b1d09de89ec1a76cf2ce9a9289a392d5a';
const DEV_SIGNING_PUBLIC_KEY_HEX = bytesToHex(
  ed25519.getPublicKey(hexToBytes(DEV_SIGNING_PRIVATE_KEY_HEX)),
);

interface SecurityHeaders {
  idempotencyKey: string;
  nonce: string;
  signature: string;
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

describe('Admin alerts', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY = DEV_SIGNING_PUBLIC_KEY_HEX;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY;
  });

  const client = (): TestClient => supertest(server) as unknown as TestClient;

  async function registerUser(prefix: string): Promise<{ token: string; accountId: string }> {
    const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    const body = { email, password: 'Pass1234!', fullName: `${prefix} User` } as const;
    const path = '/auth/register';
    const { request } = applySecurity(client().post(path), 'POST', path, body);
    const response = await request.send(body).expect(201);
    const payload = getResponseBody<{
      token?: string;
      account?: { id?: string };
    }>(response);
    return {
      token: payload.token as string,
      accountId: payload.account?.id as string,
    };
  }

  async function performTransfer(
    token: string,
    sourceAccountId: string,
    amount: number,
    counterparty: string,
  ): Promise<void> {
    const path = '/tx/transfer';
    const body = {
      sourceAccountId,
      destinationAccountId: counterparty,
      amount: { currency: 'QZD', value: amount.toFixed(2) },
    } as const;
    const { request } = applySecurity(client().post(path), 'POST', path, body);
    await request.set('Authorization', `Bearer ${token}`).send(body).expect(201);
  }

  async function acknowledgeAlert(token: string, alertId: string): Promise<void> {
    const path = `/admin/alerts/${alertId}/ack`;
    const body = {};
    const { request } = applySecurity(client().post(path), 'POST', path, body);
    await request.set('Authorization', `Bearer ${token}`).send(body).expect(204);
  }

  it('emits a new-account burst alert and supports acknowledgement', async () => {
    const { token } = await registerUser('admin');

    // Trigger multiple rapid registrations to simulate a burst of new accounts.
    for (let index = 0; index < 5; index += 1) {
      await registerUser(`burst-${index}`);
    }

    const response = await client().get('/admin/alerts').set('Authorization', `Bearer ${token}`).expect(200);
    const payload = getResponseBody<{
      alerts?: Array<{ id?: string; rule?: string }>;
    }>(response);

    const burstAlert = (payload.alerts ?? []).find((alert) => alert.rule === 'new_account_burst');
    expect(burstAlert?.id).toBeTruthy();

    await acknowledgeAlert(token, burstAlert!.id!);

    const afterAckResponse = await client()
      .get('/admin/alerts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const afterAckPayload = getResponseBody<{
      alerts?: Array<{ id?: string }>;
    }>(afterAckResponse);

    expect(afterAckPayload.alerts?.some((alert) => alert.id === burstAlert!.id)).toBe(false);
  });

  it('raises structuring and velocity alerts for suspicious transfer activity', async () => {
    const { token, accountId } = await registerUser('alerts');

    await performTransfer(token, accountId, 98, `${accountId}-dest1`);
    await performTransfer(token, accountId, 99, `${accountId}-dest2`);
    await performTransfer(token, accountId, 97, `${accountId}-dest3`);

    const structuringResponse = await client()
      .get('/admin/alerts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const structuringPayload = getResponseBody<{
      alerts?: Array<{ id?: string; rule?: string; details?: Record<string, unknown> }>;
    }>(structuringResponse);

    const structuringAlert = (structuringPayload.alerts ?? []).find((alert) => alert.rule === 'structuring');
    expect(structuringAlert?.id).toBeTruthy();
    expect(structuringAlert?.details?.accountId).toBe(accountId);

    await acknowledgeAlert(token, structuringAlert!.id!);

    for (let index = 0; index < 5; index += 1) {
      await performTransfer(token, accountId, 5, `${accountId}-velocity-${index}`);
    }

    const velocityResponse = await client().get('/admin/alerts').set('Authorization', `Bearer ${token}`).expect(200);
    const velocityPayload = getResponseBody<{
      alerts?: Array<{ rule?: string; details?: Record<string, unknown> }>;
    }>(velocityResponse);

    const velocityAlert = (velocityPayload.alerts ?? []).find((alert) => alert.rule === 'velocity');
    expect(velocityAlert?.details?.accountId).toBe(accountId);
  });
});
