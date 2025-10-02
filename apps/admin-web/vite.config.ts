import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

const projectRoot = new URL('.', import.meta.url);
const sdkBrowserEntry = fileURLToPath(new URL('../../packages/sdk-browser/src/index.ts', projectRoot));
const sdkApiBrowserEntry = fileURLToPath(new URL('../../packages/sdk-api/src/browser/index.ts', projectRoot));
const sdkApiBrowserDir = fileURLToPath(new URL('../../packages/sdk-api/src/browser', projectRoot));
const sdkApiBrowserDirWithSlash = sdkApiBrowserDir.endsWith('/') ? sdkApiBrowserDir : `${sdkApiBrowserDir}/`;
const sharedSrcEntry = fileURLToPath(new URL('../../packages/shared/src/index.ts', projectRoot));
const sharedSrcDir = fileURLToPath(new URL('../../packages/shared/src', projectRoot));
const sharedSrcDirWithSlash = sharedSrcDir.endsWith('/') ? sharedSrcDir : `${sharedSrcDir}/`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@qzd/sdk-browser', replacement: sdkBrowserEntry },
      { find: /^@qzd\/sdk-api\/browser$/, replacement: sdkApiBrowserEntry },
      { find: /^@qzd\/sdk-api\/browser\/(.*)$/, replacement: `${sdkApiBrowserDirWithSlash}$1` },
      { find: /^@qzd\/shared$/, replacement: sharedSrcEntry },
      { find: /^@qzd\/shared\/(.*)$/, replacement: `${sharedSrcDirWithSlash}$1.ts` }
    ]
  },
  server: {
    host: '0.0.0.0'
  },
  build: {
    sourcemap: true
  }
});
