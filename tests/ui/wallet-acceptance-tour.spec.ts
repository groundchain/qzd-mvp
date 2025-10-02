import { expect, Locator, Page, test } from '@playwright/test';
import { registerUser } from './support/wallet-api.ts';

const SELECT_ALL = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

async function clearAndType(locator: Locator, value: string) {
  await locator.focus();
  await locator.press(SELECT_ALL);
  await locator.press('Delete');
  if (value.length > 0) {
    await locator.pressSequentially(value);
  }
}

async function activateWithEnter(page: Page, locator: Locator) {
  await locator.focus();
  await page.keyboard.press('Enter');
}

test.describe.configure({ mode: 'serial' });

test('wallet acceptance tour is keyboard accessible', async ({ page }) => {
  const [primary, recipient] = await Promise.all([
    registerUser('wallet-tour-primary'),
    registerUser('wallet-tour-recipient'),
  ]);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const loginPanel = page.getByRole('heading', { level: 3, name: 'Log in' }).locator('..');
  await expect(loginPanel).toBeVisible();

  await test.step('signs in using keyboard interactions', async () => {
    await clearAndType(loginPanel.getByLabel('Email'), primary.email);
    await clearAndType(loginPanel.getByLabel('Password'), primary.password);
    await activateWithEnter(page, loginPanel.getByRole('button', { name: 'Sign in' }));
    await expect(page.getByRole('status')).toHaveText('Logged in successfully.');
  });

  await test.step('loads the account by submitting the form with Enter', async () => {
    await clearAndType(page.getByLabel('Account ID'), primary.accountId);
    await activateWithEnter(page, page.getByRole('button', { name: 'Load account' }));

    const balanceRegion = page.getByRole('region', { name: 'Balance' });
    await expect(balanceRegion.getByRole('definition').first()).toHaveText('1000.00 QZD');
    await expect(balanceRegion.getByRole('definition').nth(1)).toHaveText('1000.00 QZD');
  });

  await test.step('submits a transfer entirely via keyboard', async () => {
    const transferRegion = page.getByRole('region', { name: 'Send transfer' });

    await clearAndType(transferRegion.getByLabel('Destination account'), recipient.accountId);
    await clearAndType(transferRegion.getByLabel('Amount'), '0.50');
    await clearAndType(transferRegion.getByLabel('Memo'), 'Keyboard acceptance transfer');

    const submitTransferButton = transferRegion.locator('form button[type="submit"]');
    await activateWithEnter(page, submitTransferButton);
    await expect(submitTransferButton).toBeDisabled();
    await expect.poll(async () => {
      const announcements = await page.getByRole('status').allTextContents();
      return announcements.includes('Transfer submitted successfully.');
    }).toBe(true);
    await expect(submitTransferButton).toBeEnabled();
    await expect(submitTransferButton).toHaveText('Send');

    const transactionsRegion = page.getByRole('region', { name: 'Transactions' });
    const latestTransaction = transactionsRegion.getByRole('listitem').first();
    await expect(latestTransaction).toContainText('transfer');
    await expect(latestTransaction).toContainText('0.50 QZD');
    await expect(latestTransaction).toContainText(`Counterparty: ${recipient.accountId}`);
  });

  await test.step('previews a quote using keyboard navigation', async () => {
    const quoteSection = page.getByRole('region', { name: 'Preview quote' });

    await clearAndType(quoteSection.getByLabel('USD amount'), '25');

    const previewQuoteButton = quoteSection.locator('form button[type="submit"]');
    await activateWithEnter(page, previewQuoteButton);
    await expect(previewQuoteButton).toBeDisabled();

    const quoteDetailsHeading = quoteSection.getByRole('heading', { level: 3, name: 'Quote details' });
    await expect(quoteDetailsHeading).toBeVisible();
    await expect(previewQuoteButton).toBeEnabled();
    await expect(previewQuoteButton).toHaveText('Preview quote');
  });
});
