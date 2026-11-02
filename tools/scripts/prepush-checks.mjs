#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const STUDIO = 'apps/ethlete-studio/';
const LIVE_INPUTS = [STUDIO, '.ethlete/design/', 'libs/cli/src/lib/design/'];
const VISIBLE_INPUTS = [STUDIO, 'libs/components/', 'libs/core/', '.ethlete/design/studio/'];
const EVERY_PART_INPUTS = ['libs/components/', 'libs/core/', `${STUDIO}src/styles`, `${STUDIO}src/styles.css`];
const usage = 'usage: prepush-checks.mjs <specs|design|live|visible> <base> <head> [vitest cache dir]';

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

const touches = (inputs) => changes.some(({ file }) => inputs.some((prefix) => file.startsWith(prefix)));
const run = (command, args) => spawnSync(command, args, { cwd: root, stdio: 'inherit' }).status ?? 1;
const designCheck = (projects, ...args) => {
  const built = run('yarn', ['nx', 'run-many', '-t', 'build', '-p', ...projects]);

  return built === 0
    ? run('node', ['dist/libs/cli/src/index.js', 'design', 'check', '--product', 'studio', ...args])
    : built;
};

if (kind === 'live') {
  if (!touches(LIVE_INPUTS)) process.exit(0);

  const worktree = process.env.ETHLETE_PREPUSH_WORKTREE;

  if (worktree && resolve(worktree) !== root) {
    const { copyOpenSketches } = await jiti.import(resolve(design, 'prepush-sketches.ts'));
    copyOpenSketches({ from: worktree, to: root });
  }

  process.exit(designCheck(['cli'], '--live'));
}

if (kind === 'visible') {
  if (!touches(VISIBLE_INPUTS)) process.exit(0);

  const { readConfig } = await jiti.import(resolve(design, 'paths.ts'));
  const { visibleChangePartsOf } = await jiti.import(resolve(design, 'system/visible-change-parts.ts'));
  const parts = visibleChangePartsOf({
    target: root,
    config: readConfig(root) ?? {},
    name: 'studio',
    changes,
    everyPartInputs: EVERY_PART_INPUTS,
  });

  if (parts !== 'all' && parts.size === 0) {
    console.log('visible-change: no design part changed');
    process.exit(0);
  }

  process.exit(
    designCheck(
      ['cli', 'components'],
      '--visible-change',
      '--base',
      base,
      ...(parts === 'all' ? [] : ['--part', ...parts]),
    ),
  );
}

console.error(usage);
process.exit(2);
