import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const sdkSrcDir = fileURLToPath(new URL('../../packages/sdk/src/', import.meta.url));
const sdkBrowserSrcDir = fileURLToPath(new URL('../../packages/sdk-browser/src/', import.meta.url));
const sdkApiBrowserStub = fileURLToPath(new URL('./src/test-stubs/sdk-api-browser.ts', import.meta.url));
const sharedSrcDir = fileURLToPath(new URL('../../packages/shared/src/', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@qzd\/sdk$/,
        replacement: fileURLToPath(new URL('../../packages/sdk/src/index.ts', import.meta.url))
      },
      {
        find: /^@qzd\/sdk\/(.*)$/,
        replacement: `${sdkSrcDir}$1`
      },
      {
        find: /^@qzd\/sdk-browser$/,
        replacement: fileURLToPath(new URL('../../packages/sdk-browser/src/index.ts', import.meta.url))
      },
      {
        find: /^@qzd\/sdk-browser\/(.*)$/,
        replacement: `${sdkBrowserSrcDir}$1`
      },
      {
        find: /^@qzd\/sdk-api\/browser$/,
        replacement: sdkApiBrowserStub
      },
      {
        find: /^@qzd\/sdk-api\/browser\/(.*)$/,
        replacement: sdkApiBrowserStub
      },
      {
        find: /^@qzd\/shared$/,
        replacement: fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url))
      },
      {
        find: /^@qzd\/shared\/(.*)$/,
        replacement: `${sharedSrcDir}$1`
      }
    ]
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts'
  }
});
