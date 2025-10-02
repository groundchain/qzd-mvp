import { mergeConfig, defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['src/**/*.e2e.spec.ts'],
      coverage: {
        enabled: false
      }
    }
  })
);
