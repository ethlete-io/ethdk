#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const built = resolve(root, 'dist/libs/cli');
const runtime = resolve(root, 'dist/apps/ethlete-studio/cli-runtime');

const manifest = JSON.parse(readFileSync(resolve(built, 'package.json'), 'utf8'));

/**
 * `playwright` is left out: only the browser stage of `et design check` needs it, and it wants a
 * browser download of its own. Every other version is the one the package declares, so the shipped
 * copy can never drift from the published one.
 */
const dependencies = { ...manifest.dependencies, tslib: manifest.peerDependencies.tslib };

rmSync(runtime, { recursive: true, force: true });
mkdirSync(runtime, { recursive: true });
writeFileSync(
  resolve(runtime, 'package.json'),
  `${JSON.stringify({ name: 'ethlete-studio-design-runtime', private: true, dependencies }, null, 2)}\n`,
);

/**
 * `--omit=optional` would drop esbuild's platform binary, which vite cannot run without. The
 * install is therefore per platform, which is what a bundle is anyway.
 */
execFileSync('npm', ['install', '--omit=dev', '--omit=peer', '--no-audit', '--no-fund', '--no-package-lock'], {
  cwd: runtime,
  stdio: 'inherit',
});

cpSync(built, resolve(runtime, 'node_modules/@ethlete/cli'), { recursive: true });

console.log(`design runtime written to ${runtime}`);
