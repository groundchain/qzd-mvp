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
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 80
      }
    }
  }
});
