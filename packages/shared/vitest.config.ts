import { defineConfig } from 'vitest/config';

const coverageFlag = process.env.COVERAGE;
const enableCoverage = coverageFlag ? coverageFlag !== 'false' : Boolean(process.env.CI);

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      enabled: enableCoverage,
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 1,
        branches: 0,
        functions: 0,
        lines: 1
      }
    }
  }
});
