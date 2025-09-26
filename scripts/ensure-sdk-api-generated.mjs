import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const repoRoot = resolve(cwd, '..', '..');

const requiredFiles = [
  'packages/sdk-api/src/server/generated/index.ts',
  'packages/sdk-api/src/browser/generated/index.ts',
  'packages/sdk-api/src/node/generated/index.ts'
].map((relativePath) => resolve(repoRoot, relativePath));

const needsGeneration = requiredFiles.some((filePath) => !existsSync(filePath));

if (needsGeneration) {
  const result = spawnSync('pnpm', ['--dir', repoRoot, 'run', 'gen:sdks'], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
