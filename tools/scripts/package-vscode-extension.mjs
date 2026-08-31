import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXTENSION_ROOT = resolve('apps/timetrack-vscode');
const OUT_DIR = resolve('dist/apps/timetrack-vscode');

/**
 * Packs the built VS Code extension into an installable `.vsix`.
 *
 * `--no-dependencies` holds only because esbuild bundles everything into `dist/extension.js`. A runtime
 * `dependencies` entry added to the manifest would not be packed, and would fail in the editor, not here.
 */
const { version } = JSON.parse(readFileSync(resolve(EXTENSION_ROOT, 'package.json'), 'utf8'));
const vsix = resolve(OUT_DIR, `timetrack-vscode-${version}.vsix`);

mkdirSync(OUT_DIR, { recursive: true });

execFileSync(resolve('node_modules/.bin/vsce'), ['package', '--no-dependencies', '--out', vsix], {
  cwd: EXTENSION_ROOT,
  stdio: 'inherit',
});

console.log(vsix);
