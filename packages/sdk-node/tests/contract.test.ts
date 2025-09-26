import { beforeAll, describe, expect, it } from 'vitest';
import { ensureContractMockServer } from '../../../tests/contract-mock-server';

describe('Node SDK contract', () => {
  let baseUrl!: string;
  beforeAll(async () => {
    baseUrl = await ensureContractMockServer();
  });

  it('returns liveness payload from GET /health/live', async () => {
    const response = await fetch(`${baseUrl}/health/live`);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toBeDefined();
    expect(typeof payload.status).toBe('string');
    expect(payload.status.length).toBeGreaterThan(0);
  });

  it('returns login token from POST /auth/login', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.merchant@example.com',
        password: 'Sup3rS3cret!',
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(typeof payload.token).toBe('string');
    expect(payload.token.length).toBeGreaterThan(0);
    expect(typeof payload.expiresIn).toBe('number');
    expect(payload.expiresIn).toBeGreaterThan(0);
  });
});
