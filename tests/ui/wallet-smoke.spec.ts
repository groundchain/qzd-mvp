import { expect, test } from '@playwright/test';
import { registerUser } from './support/wallet-api.ts';

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
