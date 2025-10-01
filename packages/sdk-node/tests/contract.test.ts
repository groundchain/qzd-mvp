import { randomUUID } from 'node:crypto';

import type { AxiosError } from 'axios';
import type { ModelError } from '@qzd/sdk-node';
import { beforeAll, describe, expect, it } from 'vitest';

const contractBaseUrl = process.env.CONTRACT_BASE_URL;
const shouldRunContractSuite = Boolean(contractBaseUrl);

type NodeSdk = typeof import('@qzd/sdk-node');

describe.skipIf(!shouldRunContractSuite)('Node SDK contract', () => {
  let baseUrl: string;
  let sdk: NodeSdk;
  let unauthenticatedConfig: InstanceType<NodeSdk['Configuration']>;

  beforeAll(async () => {
    if (!contractBaseUrl) {
      throw new Error('CONTRACT_BASE_URL must be provided when running contract tests.');
    }

    baseUrl = contractBaseUrl;
    sdk = await import('@qzd/sdk-node');
    unauthenticatedConfig = new sdk.Configuration({ basePath: baseUrl });
  });

  const login = async (): Promise<string> => {
    const authApi = new sdk.AuthApi(unauthenticatedConfig);
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
    const api = new sdk.HealthApi(unauthenticatedConfig);
    const { data } = await api.getLiveness();

    expect(data.status).toBe('live');
  });

  it('simulates a DEFAULT quote for $100 USD', async () => {
    const token = await login();
    const authenticatedConfig = new sdk.Configuration({
      basePath: baseUrl,
      accessToken: token,
    });

    const api = new sdk.RemittancesApi(authenticatedConfig);
    const { data } = await api.simulateQuote({
      usdAmount: '100.00',
      scenario: sdk.QuoteScenario.Default,
    });

    expect(data.quoteId).toBe('quote_default_000001');
    expect(data.sellAmount).toEqual({ currency: 'USD', value: '100.00' });
    expect(data.buyAmount).toEqual({ currency: 'QZD', value: '772.28' });
    expect(data.rate).toBe('7.7228');
    expect(data.expiresAt).toBe('2024-05-02T12:00:00Z');
  });

  it('rejects unauthenticated balance reads', async () => {
    const api = new sdk.AccountsApi(unauthenticatedConfig);

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
