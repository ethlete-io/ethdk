#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const STUDIO = 'apps/ethlete-studio/';
const usage = 'usage: prepush-checks.mjs <specs|design> <base> <head> [vitest cache dir]';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [kind, base, head, cache] = process.argv.slice(2);

if (!kind || !base || !head) {
  console.error(usage);
  process.exit(2);
}

const jiti = createJiti(import.meta.url);
const design = resolve(root, 'libs/cli/src/lib/design');
const { parseNameStatus } = await jiti.import(resolve(design, 'prepush-changes.ts'));
const changes = parseNameStatus(
  execFileSync('git', ['diff', '--name-status', '--no-renames', base, head], { cwd: root, encoding: 'utf8' }),
);

if (kind === 'specs') {
  const { relatedFilesOf } = await jiti.import(resolve(design, 'prepush-specs.ts'));
  const related = relatedFilesOf({ changes, root: STUDIO, exists: (file) => existsSync(resolve(root, file)) });

  if (related.length === 0) process.exit(0);

  const result = spawnSync(
    'yarn',
    [
      'vitest',
      'related',
      '--run',
      '--passWithNoTests',
      '--config',
      `${STUDIO}vite.config.mts`,
      ...(cache ? ['--fsModuleCachePath', cache] : []),
      ...related.map((file) => resolve(root, file)),
    ],
    { cwd: root, stdio: 'inherit' },
  );

  process.exit(result.status ?? 1);
}

if (kind === 'design') {
  const { prepushDesignCheck } = await jiti.import(resolve(design, 'prepush-design.ts'));
  const { code, lines } = prepushDesignCheck({ target: root, changes });

  lines.forEach((line) => console.log(line));
  process.exit(code);
}

console.error(usage);
process.exit(2);
