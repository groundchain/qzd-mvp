import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@qzd/sdk-node': resolve(__dirname, 'src/index.ts'),
      '@qzd/sdk-api/node': resolve(__dirname, '../sdk-api/src/node/index.ts'),
      '@qzd/sdk-api': resolve(__dirname, '../sdk-api/src/index.ts'),
    },
  },
});
