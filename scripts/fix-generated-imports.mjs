#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';

const extsToSkip = new Set(['.mjs', '.cjs', '.json']);

async function gatherTsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await gatherTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function toPascalCase(value) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function withIndexSpecifier(specifier) {
  if (specifier.endsWith('/index')) {
    return `${specifier}.js`;
  }
  return `${specifier}/index.js`;
}

function ensureJsExtension(specifier, filePath) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return specifier;
  }

  const baseDir = dirname(filePath);
  const resolved = join(baseDir, specifier);

  const endsWithJs = specifier.endsWith('.js');
  if (endsWithJs) {
    if (!existsSync(resolved)) {
      const withoutExt = specifier.slice(0, -3);
      const asDir = join(baseDir, withoutExt);
      if (existsSync(asDir) && statSync(asDir).isDirectory()) {
        if (existsSync(join(asDir, 'index.ts')) || existsSync(join(asDir, 'index.tsx'))) {
          return withIndexSpecifier(withoutExt);
        }
      }
    }
    return specifier;
  }

  const ext = specifier.slice(-3);
  if (extsToSkip.has(ext)) {
    return specifier;
  }

  if (existsSync(resolved)) {
    const stats = statSync(resolved);
    if (stats.isDirectory()) {
      if (existsSync(join(resolved, 'index.ts')) || existsSync(join(resolved, 'index.tsx'))) {
        return withIndexSpecifier(specifier);
      }
    }
  } else if (existsSync(`${resolved}.ts`) || existsSync(`${resolved}.tsx`)) {
    return `${specifier}.js`;
  }

  return `${specifier}.js`;
}

function transform(content, filePath) {
  return content
    .replace(/from\s+(['"])(\.{1,2}\/[^'";]+)\1/g, (match, quote, specifier) => {
      const nextSpecifier = ensureJsExtension(specifier, filePath);
      return `from ${quote}${nextSpecifier}${quote}`;
    })
    .replace(/export\s+\*\s+from\s+(['"])(\.{1,2}\/[^'";]+)\1/g, (match, quote, specifier) => {
      const nextSpecifier = ensureJsExtension(specifier, filePath);
      return `export * from ${quote}${nextSpecifier}${quote}`;
    })
    .replace(/&#39;/g, "'");
}

async function rewriteFetchApiIndex(targetDir) {
  const indexPath = join(targetDir, 'apis', 'index.ts');
  try {
    await fs.access(indexPath);
  } catch {
    return;
  }

  const original = await fs.readFile(indexPath, 'utf8');
  const exportMatches = [...original.matchAll(/export\s+\*\s+from\s+(['"])(\.{1,2}\/[^'";]+)\1/g)];
  if (exportMatches.length === 0) {
    return;
  }

  const headerLines = [];
  const lines = original.split('\n');
  let index = 0;
  for (; index < lines.length; index += 1) {
    if (lines[index].startsWith('export')) {
      break;
    }
    headerLines.push(lines[index]);
  }

  const exports = exportMatches.map((match) => match[2]);
  const rewritten = [];
  for (const specifier of exports) {
    const cleaned = specifier.replace(/^\.\//, '').replace(/\.js$/, '');
    const className = cleaned;
    const typeNamespace = `${className}Types`;
    rewritten.push(`export { ${className} } from '${specifier}';`);
    rewritten.push(`export type { ${className}Interface } from '${specifier}';`);
    rewritten.push(`export * as ${typeNamespace} from '${specifier}';`);
  }

  const nextContent = `${headerLines.join('\n')}${headerLines.length ? '\n' : ''}${rewritten.join('\n')}`;
  if (nextContent !== original.trimEnd()) {
    await fs.writeFile(indexPath, `${nextContent}\n`, 'utf8');
  }
}

async function rewriteAxiosApiBarrel(targetDir) {
  const apiPath = join(targetDir, 'api.ts');
  try {
    await fs.access(apiPath);
  } catch {
    return;
  }

  const original = await fs.readFile(apiPath, 'utf8');
  const exportMatches = [...original.matchAll(/export\s+\*\s+from\s+(['"])(\.{1,2}\/[^'";]+)\1/g)];
  if (exportMatches.length === 0) {
    return;
  }

  const headerLines = [];
  const lines = original.split('\n');
  let index = 0;
  for (; index < lines.length; index += 1) {
    if (lines[index].startsWith('export')) {
      break;
    }
    headerLines.push(lines[index]);
  }

  const exports = exportMatches.map((match) => match[2]);
  const rewritten = [];
  for (const specifier of exports) {
    const cleaned = specifier.replace(/^.*\//, '').replace(/\.js$/, '');
    const className = toPascalCase(cleaned);
    const typeNamespace = `${className}Types`;
    rewritten.push(`export { ${className}, ${className}Factory, ${className}Fp, ${className}AxiosParamCreator } from '${specifier}';`);
    rewritten.push(`export * as ${typeNamespace} from '${specifier}';`);
  }

  const nextContent = `${headerLines.join('\n')}${headerLines.length ? '\n' : ''}${rewritten.join('\n')}`;
  if (nextContent !== original.trimEnd()) {
    await fs.writeFile(apiPath, `${nextContent}\n`, 'utf8');
  }
}

async function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error('Usage: node fix-generated-imports.mjs <dir> [dir...]');
    process.exitCode = 1;
    return;
  }

  for (const target of targets) {
    const files = await gatherTsFiles(target);
    for (const file of files) {
      const original = await fs.readFile(file, 'utf8');
      const updated = transform(original, file);
      if (updated !== original) {
        await fs.writeFile(file, updated, 'utf8');
      }
    }
    await rewriteFetchApiIndex(target);
    await rewriteAxiosApiBarrel(target);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
