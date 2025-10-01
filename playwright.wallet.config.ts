import { defineConfig, devices } from '@playwright/test';
import { DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX } from './packages/shared/src/request-security.ts';

const isCI = Boolean(process.env.CI);
const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:3000';
const walletBase = process.env.PLAYWRIGHT_WALLET_BASE_URL ?? 'http://127.0.0.1:5173';
const normalizedApiBase = apiBase.replace(/\/$/, '');
const normalizedWalletBase = walletBase.replace(/\/$/, '');
const walletUrl = new URL(normalizedWalletBase);
const walletPort = walletUrl.port || '5173';

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  reporter: isCI
    ? [['list'], ['github']]
    : [['list']],
  use: {
    baseURL: normalizedWalletBase,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @qzd/api dev',
      url: `${normalizedApiBase}/health/ready`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CORS_ORIGIN: normalizedWalletBase,
        QZD_REQUEST_SIGNING_PUBLIC_KEY: DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX,
      },
    },
    {
      command: `pnpm --filter @qzd/wallet-web dev -- --host ${walletUrl.hostname} --port ${walletPort} --strictPort`,
      url: normalizedWalletBase,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        VITE_API_BASE_URL: normalizedApiBase,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: normalizedWalletBase,
      },
    },
  ],
});
