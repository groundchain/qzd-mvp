import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const sharedSrcDir = fileURLToPath(new URL('../../packages/shared/src/', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@qzd\/shared$/, // direct import
        replacement: fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url))
      },
      {
        find: /^@qzd\/shared\/(.*)$/,
        replacement: `${sharedSrcDir}$1`
      },
      {
        find: /^@qzd\/ledger$/,
        replacement: fileURLToPath(new URL('../../packages/ledger/src/index.ts', import.meta.url))
      },
      {
        find: /^@qzd\/ledger\/(.*)$/,
        replacement: fileURLToPath(new URL(`../../packages/ledger/src/$1`, import.meta.url))
      }
    ]
  },
  test: {
    environment: 'node',
    coverage: {
      reporter: ['text', 'html']
    }
  }
});
