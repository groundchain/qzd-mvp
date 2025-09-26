import { beforeAll, describe, expect, it } from 'vitest';
import { ensureContractMockServer } from '../../../tests/contract-mock-server';

describe('Browser SDK contract', () => {
  let baseUrl!: string;

  beforeAll(async () => {
    baseUrl = await ensureContractMockServer();
  });

  it('provides readiness details from GET /health/ready', async () => {
    const response = await fetch(`${baseUrl}/health/ready`);
    expect(response.status).toBe(200);

    const payload: unknown = await response.json();
    expect(payload).toBeDefined();
    expect(typeof payload).toBe('object');

    const body = payload as {
      status?: unknown;
      dependencies?: Array<Record<string, unknown>>;
    };

    expect(body.status).toBe('ready');
    expect(Array.isArray(body.dependencies)).toBe(true);

    for (const dependency of body.dependencies ?? []) {
      expect(typeof dependency.name).toBe('string');
      expect((dependency.name as string).length).toBeGreaterThan(0);
      expect(typeof dependency.status).toBe('string');
    }
  });

  it('returns example registration payload for POST /auth/register', async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'alex.merchant@example.com',
        password: 'Sup3rS3cret!',
        fullName: 'Alex Merchant'
      })
    });

    expect(response.status).toBe(201);

    const payload: unknown = await response.json();
    expect(typeof payload).toBe('object');

    const body = payload as {
      userId?: unknown;
      account?: Record<string, unknown>;
      token?: unknown;
    };

    expect(typeof body.userId).toBe('string');
    expect(typeof body.token).toBe('string');
    expect(body.account).toBeDefined();

    const account = body.account ?? {};
    expect(account.ownerId).toBe(body.userId);
    expect(typeof account.id).toBe('string');
    expect(typeof account.status).toBe('string');
    expect(typeof account.createdAt).toBe('string');
  });
});
