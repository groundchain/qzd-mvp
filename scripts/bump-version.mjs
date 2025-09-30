#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const IGNORE_DIRS = new Set([
  '.git',
  '.github',
  '.husky',
  'node_modules',
  'dist',
  'build',
  '.turbo',
  '.next',
  '.output',
  '.vercel',
  'coverage',
  '.pnpm',
]);

function collectPackageJson(startDir) {
  const files = [];
  const queue = [startDir];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.')) {
          // Skip hidden directories to avoid scanning configuration folders
          continue;
        }
        queue.push(path.join(current, entry.name));
      } else if (entry.isFile() && entry.name === 'package.json') {
        files.push(path.join(current, entry.name));
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function parseSemver(input) {
  const match = input.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid semantic version: ${input}`);
  }
  return match.slice(1).map((value) => Number.parseInt(value, 10));
}

function bumpVersion(baseVersion, releaseTarget) {
  if (['major', 'minor', 'patch'].includes(releaseTarget)) {
    const [major, minor, patch] = parseSemver(baseVersion);
    switch (releaseTarget) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  // if we reach here, the target must be an explicit version string
  const nextVersion = releaseTarget.startsWith('v') ? releaseTarget.slice(1) : releaseTarget;
  const [nextMajor, nextMinor, nextPatch] = parseSemver(nextVersion);
  const [baseMajor, baseMinor, basePatch] = parseSemver(baseVersion);

  const isGreater =
    nextMajor > baseMajor ||
    (nextMajor === baseMajor && nextMinor > baseMinor) ||
    (nextMajor === baseMajor && nextMinor === baseMinor && nextPatch > basePatch);

  if (!isGreater) {
    throw new Error(
      `Provided version (${nextVersion}) must be greater than current (${baseVersion}).`,
    );
  }

  return `${nextMajor}.${nextMinor}.${nextPatch}`;
}

function updatePackageVersion(filePath, newVersion) {
  const contents = readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Unable to parse ${filePath}: ${error.message}`);
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'version')) {
    return false;
  }
  data.version = newVersion;
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return true;
}

function main() {
  const releaseTarget = process.argv[2];
  if (!releaseTarget) {
    console.error('Usage: node scripts/bump-version.mjs <version|major|minor|patch>');
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const rootPackagePath = path.join(repoRoot, 'package.json');
  const rootContents = readFileSync(rootPackagePath, 'utf8');
  const rootJson = JSON.parse(rootContents);
  const currentVersion = rootJson.version;

  const newVersion = bumpVersion(currentVersion, releaseTarget);

  const packageFiles = collectPackageJson(repoRoot);
  let updatedCount = 0;
  for (const file of packageFiles) {
    if (updatePackageVersion(file, newVersion)) {
      updatedCount += 1;
    }
  }

  if (updatedCount === 0) {
    console.error('No package.json files were updated.');
    process.exit(1);
  }

  console.error(`Updated ${updatedCount} package.json files to version ${newVersion}.`);
  console.log(newVersion);
}

main();
