import { expect, test } from '@playwright/test';
import {
  applyMutationSecurityHeaders,
  createMutationSecurityHeaders,
} from '../../packages/shared/src/request-security.ts';

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:3000';
const normalizedApiBase = apiBase.replace(/\/$/, '');

const signedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type RegisterResponse = {
  account?: { id?: string | null } | null;
  token?: string | null;
};

type RegisteredUser = {
  email: string;
  password: string;
  accountId: string;
};

async function signedJsonFetch<TResponse>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<TResponse> {
  const method = (options.method ?? 'GET').toUpperCase();
  const url = new URL(path, normalizedApiBase);
  const headers = new Headers({ Accept: 'application/json' });
  let bodyText: string | undefined;

  if (options.body !== undefined) {
    bodyText = JSON.stringify(options.body);
    headers.set('Content-Type', 'application/json');
  }

  if (signedMethods.has(method)) {
    const securityHeaders = createMutationSecurityHeaders(
      method,
      `${url.pathname}${url.search}`,
      options.body ?? null,
    );
    applyMutationSecurityHeaders(headers, securityHeaders);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: bodyText,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Request failed: ${method} ${url.toString()} → ${response.status} ${response.statusText} — ${errorBody}`,
    );
  }

  const raw = await response.text();
  return raw ? (JSON.parse(raw) as TResponse) : (undefined as TResponse);
}

async function registerUser(prefix: string): Promise<RegisteredUser> {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `${prefix}-${unique}@example.com`;
  const password = `Pw-${unique}`;
  const fullName = `${prefix.replace(/[-_]+/g, ' ')} Smoke`;

  const payload = await signedJsonFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, fullName },
  });

  const accountId = payload.account?.id;
  if (!accountId) {
    throw new Error('Registration response did not include an account id');
  }

  return { email, password, accountId };
}

test.describe.configure({ mode: 'serial' });

test('wallet happy path smoke test', async ({ page }) => {
  const [primary, recipient] = await Promise.all([
    registerUser('wallet-primary'),
    registerUser('wallet-recipient'),
  ]);

  await page.goto('/');

  const loginPanel = page.getByRole('heading', { level: 3, name: 'Log in' }).locator('..');
  await expect(loginPanel).toBeVisible();
  await loginPanel.getByLabel('Email').fill(primary.email);
  await loginPanel.getByLabel('Password').fill(primary.password);
  await loginPanel.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Logged in successfully.')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Load account' })).toBeVisible();
  await page.getByLabel('Account ID').fill(primary.accountId);
  await page.getByRole('button', { name: 'Load account' }).click();

  const balanceRegion = page.getByRole('region', { name: 'Balance' });
  await expect(balanceRegion.getByRole('definition').first()).toHaveText('1000.00 QZD');
  await expect(
    page.getByRole('region', { name: 'Transactions' }).getByText('No transactions to display.'),
  ).toBeVisible();

  const transferRegion = page.getByRole('region', { name: 'Send transfer' });
  const transferAmount = '0.25';
  await transferRegion.getByLabel('Destination account').fill(recipient.accountId);
  await transferRegion.getByLabel('Amount').fill(transferAmount);
  await transferRegion.getByLabel('Memo').fill('UI smoke transfer');
  await transferRegion.getByRole('button', { name: 'Send' }).click();

  const expectedBalance = (1000 - Number(transferAmount)).toFixed(2);
  await expect(balanceRegion.getByRole('definition').first()).toHaveText(`${expectedBalance} QZD`);
  await expect(balanceRegion.getByRole('definition').nth(1)).toHaveText(`${expectedBalance} QZD`);

  const transactionsRegion = page.getByRole('region', { name: 'Transactions' });
  await expect(transactionsRegion.getByText('No transactions to display.')).not.toBeVisible();

  const latestTransaction = transactionsRegion.getByRole('listitem').first();
  await expect(latestTransaction).toContainText('transfer');
  await expect(latestTransaction).toContainText(`${transferAmount} QZD`);
  await expect(latestTransaction).toContainText(`Counterparty: ${recipient.accountId}`);
});
