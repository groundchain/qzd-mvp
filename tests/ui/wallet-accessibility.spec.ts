import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page, test } from '@playwright/test';

import { registerUser } from './support/wallet-api.ts';

async function expectNoCriticalViolations(page: Page, context: string, scope?: Locator) {
  const builder = new AxeBuilder({ page });
  if (scope) {
    const handle = await scope.elementHandle();
    if (handle) {
      builder.include(handle);
    }
  }

  const results = await builder.analyze();
  const criticalViolations = results.violations.filter((violation) => violation.impact === 'critical');

  if (criticalViolations.length > 0) {
    const details = criticalViolations
      .map((violation) => {
        const nodes = violation.nodes
          .map((node) => `    • ${node.html}`)
          .slice(0, 5)
          .join('\n');
        return `- ${violation.id} (${violation.help}):\n${nodes}`;
      })
      .join('\n');

    throw new Error(`Critical accessibility violations detected in ${context}:\n${details}`);
  }
}

test.describe.configure({ mode: 'serial' });

test('wallet flows remain free of critical axe violations', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const loginPanel = page.getByRole('heading', { level: 3, name: 'Log in' }).locator('..');
  await expect(loginPanel).toBeVisible();
  await expectNoCriticalViolations(page, 'login screen');

  const user = await registerUser('wallet-a11y');
  await loginPanel.getByLabel('Email').fill(user.email);
  await loginPanel.getByLabel('Password').fill(user.password);
  await loginPanel.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Logged in successfully.')).toBeVisible();
  await expectNoCriticalViolations(page, 'dashboard after authentication');

  await page.getByLabel('Account ID').fill(user.accountId);
  await page.getByRole('button', { name: 'Load account' }).click();

  const balanceRegion = page.getByRole('region', { name: 'Balance' });
  await expect(balanceRegion).toBeVisible();
  await expectNoCriticalViolations(page, 'account overview', balanceRegion);

  const transferRegion = page.getByRole('region', { name: 'Send transfer' });
  await expect(transferRegion).toBeVisible();
  await expectNoCriticalViolations(page, 'send transfer form', transferRegion);
});
