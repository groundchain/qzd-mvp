import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const sharedSrcDir = fileURLToPath(new URL('../../packages/shared/src/', import.meta.url));
const sdkApiServerDir = fileURLToPath(new URL('../../packages/sdk-api/src/server/', import.meta.url));
const require = createRequire(import.meta.url);
const nobleHashesDir = dirname(require.resolve('@noble/hashes/sha256.js')).replace(/\\/g, '/');
const nobleCurvesDir = dirname(require.resolve('@noble/curves/secp256k1.js')).replace(/\\/g, '/');
const coverageFlag = process.env.COVERAGE;
const enableCoverage = coverageFlag ? coverageFlag !== 'false' : Boolean(process.env.CI);

export default defineConfig({
  ssr: {
    noExternal: ['@noble/hashes', '@noble/curves']
  },
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
      },
      {
        find: /^@qzd\/card-mock$/, 
        replacement: fileURLToPath(new URL('../../packages/card-mock/src/index.ts', import.meta.url))
      },
      {
        find: /^@qzd\/card-mock\/(.*)$/, 
        replacement: fileURLToPath(new URL(`../../packages/card-mock/src/$1`, import.meta.url))
      },
      {
        find: /^@qzd\/sdk-api\/server$/,
        replacement: fileURLToPath(new URL('../../packages/sdk-api/src/server/index.ts', import.meta.url))
      },
      {
        find: /^@qzd\/sdk-api\/server\/(.*)$/,
        replacement: `${sdkApiServerDir}$1`
      },
      {
        find: /^@noble\/hashes$/,
        replacement: `${nobleHashesDir}/index.js`
      },
      {
        find: /^@noble\/hashes\/(.*)\.js$/,
        replacement: `${nobleHashesDir}/$1.js`
      },
      {
        find: /^@noble\/hashes\/(.*)$/,
        replacement: `${nobleHashesDir}/$1.js`
      },
      {
        find: /^@noble\/curves$/,
        replacement: `${nobleCurvesDir}/index.js`
      },
      {
        find: /^@noble\/curves\/(.*)\.js$/,
        replacement: `${nobleCurvesDir}/$1.js`
      },
      {
        find: /^@noble\/curves\/(.*)$/,
        replacement: `${nobleCurvesDir}/$1.js`
      }
    ]
  },
  test: {
    environment: 'node',
    server: {
      deps: {
        inline: ['@noble/hashes', '@noble/curves']
      }
    },
    deps: {
      optimizer: {
        ssr: {
          include: ['@noble/hashes', '@noble/curves']
        }
      }
    },
    coverage: {
      enabled: enableCoverage,
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 10,
        branches: 50,
        functions: 50,
        lines: 10
      }
    }
  }
});
