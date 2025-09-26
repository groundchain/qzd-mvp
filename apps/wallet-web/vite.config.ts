import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

const projectRoot = new URL('.', import.meta.url);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@qzd/sdk-browser': fileURLToPath(new URL('../../packages/sdk-browser/src/index.ts', projectRoot))
    }
  },
  build: {
    sourcemap: true
  }
});
