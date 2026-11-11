#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { linkInstalledDependencies } from './commit-export.mjs';

/** Returns an error when a scratch's shot store resolves into the main checkout. */
export const storeEscapes = (repo, dir) => {
  const store = join(dir, 'node_modules/.design-explore');
  if (!existsSync(store)) return undefined;
  const real = realpathSync(store);
  const root = realpathSync(repo);
  return real === root || real.startsWith(root + sep)
    ? `the scratch shot store ${store} resolves to ${real}, inside the main checkout ${root}; a scratch run would write into the live store`
    : undefined;
};

/** Copies the working tree (tracked files with uncommitted edits, plus untracked unignored files) into `dir` and links the repo's dependencies. */
export const scratchCheckout = (repo, dir) => {
  if (existsSync(dir) && readdirSync(dir).length) return { error: `${dir} exists and is not empty` };
  mkdirSync(dir, { recursive: true });
  const copy = spawnSync(
    'bash',
    [
      '-c',
      'set -o pipefail; { git ls-files -z --cached --others --exclude-standard; } | while IFS= read -r -d "" f; do [ -e "$f" ] && printf "%s\\0" "$f"; done | tar --null -T - -c | tar -x -C "$1"',
      'scratch',
      dir,
    ],
    { cwd: repo, encoding: 'utf8' },
  );
  if (copy.status !== 0) return { error: copy.stderr.trim() || `copy exited ${copy.status}` };
  linkInstalledDependencies(repo, dir);
  mkdirSync(join(dir, 'node_modules/.design-explore'), { recursive: true });
  const escape = storeEscapes(repo, dir);
  if (escape) return { error: escape };
  return { dir };
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: yarn scratch:checkout <dir>');
    process.exit(2);
  }
  const repo = process.env['ETHLETE_REPO_ROOT'] ?? resolve(import.meta.dirname, '../..');
  const result = scratchCheckout(repo, resolve(target));
  if (result.error) {
    console.error(`scratch-checkout: ${result.error}`);
    process.exit(1);
  }
  console.log(result.dir);
}
