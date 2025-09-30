#!/usr/bin/env node
import { rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LinkState, check } from 'linkinator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(repoRoot, 'docs/.vitepress/dist');
const symlinkPath = path.join(distDir, 'qzd-mvp');

async function run() {
  await rm(symlinkPath, { force: true });
  await symlink('.', symlinkPath);

  try {
    const { links } = await check({
      path: './index.html',
      recurse: true,
      timeout: 60000,
      serverRoot: distDir,
      verbosity: 'warning',
      skip: [
        /https:\/\/groundchain\.github\.io\/qzd-mvp\/.+/, 
        /https?:\/\/localhost(:\d+)?(\/.*)?/,
        /https:\/\/qzd\.example\.com(\/.*)?/,
      ],
    });

    const broken = links.filter((link) => link.state === LinkState.BROKEN);
    if (broken.length > 0) {
      for (const link of broken) {
        console.error(`${link.state} ${link.url}`);
      }
      throw new Error(`Detected ${broken.length} broken link(s).`);
    }

    console.log(`Scanned ${links.length} links with no broken links detected.`);
  } finally {
    await rm(symlinkPath, { force: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
