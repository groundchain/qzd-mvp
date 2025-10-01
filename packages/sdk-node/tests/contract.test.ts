import { randomUUID } from 'node:crypto';

import type { AxiosError } from 'axios';
import {
  AccountsApi,
  AuthApi,
  Configuration,
  HealthApi,
  ModelError,
  QuoteScenario,
  RemittancesApi,
} from '@qzd/sdk-node';
import { beforeAll, describe, expect, it } from 'vitest';

import { ensureContractMockServer } from '../../../tests/contract-mock-server';

describe('Node SDK contract', () => {
  let baseUrl: string;
  let unauthenticatedConfig: Configuration;

  beforeAll(async () => {
    baseUrl = await ensureContractMockServer();
    unauthenticatedConfig = new Configuration({ basePath: baseUrl });
  });

  const login = async (): Promise<string> => {
    const authApi = new AuthApi(unauthenticatedConfig);
    const { data } = await authApi.loginUser({
      idempotencyKey: randomUUID(),
      loginUserRequest: {
        email: 'alex.merchant@example.com',
        password: 'Sup3rS3cret!',
      },
    });

    expect(data.token).toBeTruthy();
    return data.token;
  };

  it('reports live status from GET /health/live', async () => {
    const api = new HealthApi(unauthenticatedConfig);
    const { data } = await api.getLiveness();

    expect(data.status).toBe('live');
  });

  it('simulates a DEFAULT quote for $100 USD', async () => {
    const token = await login();
    const authenticatedConfig = new Configuration({
      basePath: baseUrl,
      accessToken: token,
    });

    const api = new RemittancesApi(authenticatedConfig);
    const { data } = await api.simulateQuote({
      usdAmount: '100.00',
      scenario: QuoteScenario.Default,
    });

    expect(data.quoteId).toBe('quote_default_000001');
    expect(data.sellAmount).toEqual({ currency: 'USD', value: '100.00' });
    expect(data.buyAmount).toEqual({ currency: 'QZD', value: '772.28' });
    expect(data.rate).toBe('7.7228');
    expect(data.expiresAt).toBe('2024-05-02T12:00:00Z');
  });

  it('rejects unauthenticated balance reads', async () => {
    const api = new AccountsApi(unauthenticatedConfig);

    await expect(api.getAccountBalance({ id: 'acc_987654321' })).rejects.toMatchObject<
      AxiosError<ModelError>
    >({
      response: {
        status: 401,
        data: {
          code: 'UNAUTHORIZED',
          message: 'Bearer token is invalid or expired.',
        },
      },
    });
  });
});
