import axios from 'axios';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureContractMockServer } from '../../../tests/contract-mock-server';

const BASE_URL = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:4010';
const client = axios.create({ baseURL: BASE_URL });

describe('Node SDK contract', () => {
  beforeAll(async () => {
    await ensureContractMockServer();
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
