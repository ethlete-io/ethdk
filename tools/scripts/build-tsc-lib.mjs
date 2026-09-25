// Replacement for the @nx/js:tsc executor: compile a plain-TS lib, copy its
// assets, and emit a dist package.json with `types` pointing at the built
// declarations. Usage: node tools/scripts/build-tsc-lib.mjs <lib-name> [asset-dir...]

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [lib, ...assetDirs] = process.argv.slice(2);

if (!lib) {
  console.error('Usage: build-tsc-lib.mjs <lib-name> [asset-dir...]');
  process.exit(1);
}

const workspaceRoot = resolve(import.meta.dirname, '../..');
const projectRoot = join(workspaceRoot, 'libs', lib);
const outDir = join(workspaceRoot, 'dist/libs', lib);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

execFileSync(
  'npx',
  [
    'tsc',
    '-p',
    join(projectRoot, 'tsconfig.lib.json'),
    '--outDir',
    join(outDir, 'src'),
    '--rootDir',
    join(projectRoot, 'src'),
  ],
  { stdio: 'inherit', cwd: workspaceRoot },
);

for (const file of ['README.md', 'CHANGELOG.md']) {
  const from = join(projectRoot, file);
  if (existsSync(from)) cpSync(from, join(outDir, file));
}

for (const dir of assetDirs) {
  const from = join(projectRoot, dir);
  if (existsSync(from)) cpSync(from, join(outDir, dir), { recursive: true });
}

const manifest = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
manifest.types = manifest.typings ?? './src/index.d.ts';
writeFileSync(join(outDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Built @ethlete/${lib} -> dist/libs/${lib}`);
