import { existsSync } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

function findRepoRoot(startDir) {
  let current = startDir;
  while (true) {
    if (existsSync(resolve(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error('Unable to locate repository root from ensure-sdk-api-generated script');
    }

    current = parent;
  }
}

const cwd = process.cwd();
const repoRoot = findRepoRoot(cwd);
const lockPath = resolve(repoRoot, '.openapi-generator.lock');

const requiredFiles = [
  'packages/sdk-api/src/server/generated/index.ts',
  'packages/sdk-api/src/browser/generated/index.ts',
  'packages/sdk-api/src/node/generated/index.ts'
].map((relativePath) => resolve(repoRoot, relativePath));

async function acquireLock() {
  while (true) {
    try {
      const handle = await open(lockPath, 'wx');
      return handle;
    } catch (error) {
      if (error?.code === 'EEXIST') {
        await sleep(200);
        continue;
      }
      throw error;
    }
  }
}

async function releaseLock(handle) {
  try {
    await handle.close();
  } finally {
    await unlink(lockPath).catch(() => {});
  }
}

async function runGenerator() {
  const result = await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('pnpm', ['--dir', repoRoot, 'run', 'gen:sdks'], {
      stdio: 'inherit',
    });

    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise(code);
      } else {
        rejectPromise(new Error(`OpenAPI generation failed with exit code ${code}`));
      }
    });
  });

  return result;
}

function needsGeneration() {
  return requiredFiles.some((filePath) => !existsSync(filePath));
}

if (needsGeneration()) {
  const lockHandle = await acquireLock();
  try {
    if (needsGeneration()) {
      await runGenerator();
    }
  } finally {
    await releaseLock(lockHandle);
  }
}
