import axios from 'axios';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureContractMockServer } from '../../../tests/contract-mock-server';

describe('Node SDK contract', () => {
  let baseUrl!: string;
  let client!: ReturnType<typeof axios.create>;

  beforeAll(async () => {
    baseUrl = await ensureContractMockServer();
    client = axios.create({ baseURL: baseUrl });
  });

  it('returns liveness payload from GET /health/live', async () => {
    const response = await client.get('/health/live');
    expect(response.status).toBe(200);

    expect(response.data).toBeDefined();
    expect(typeof response.data.status).toBe('string');
    expect(response.data.status.length).toBeGreaterThan(0);
  });

  it('returns login token from POST /auth/login', async () => {
    const response = await client.post('/auth/login', {
      email: 'alex.merchant@example.com',
      password: 'Sup3rS3cret!'
    });

    expect(response.status).toBe(200);
    expect(typeof response.data.token).toBe('string');
    expect(response.data.token.length).toBeGreaterThan(0);
    expect(typeof response.data.expiresIn).toBe('number');
    expect(response.data.expiresIn).toBeGreaterThan(0);
  });
});
