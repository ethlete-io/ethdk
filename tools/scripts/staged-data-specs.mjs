import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchesGlob } from './cli-related-map.mjs';

const root = join(fileURLToPath(import.meta.url), '../../..');

export const specsForData = (files, map) =>
  Object.entries(map)
    .filter(([, globs]) => files.some((file) => globs.some((glob) => matchesGlob(file, glob))))
    .map(([spec]) => spec);

const withoutGitEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

// A hook runs with GIT_DIR and GIT_INDEX_FILE set; specs that `git init` a temp repo would otherwise write into this one.
const run = (command, args) =>
  spawnSync(command, args, { cwd: root, stdio: 'inherit', env: withoutGitEnv() }).status ?? 1;

export const runSpecs = (specs) => {
  const vitest = specs.filter((spec) => spec.endsWith('.spec.ts'));
  const node = specs.filter((spec) => spec.endsWith('.spec.mjs'));
  const statuses = [];

  if (vitest.length)
    statuses.push(
      run('npx', ['vitest', 'run', '--root', 'libs/cli', ...vitest.map((s) => s.replace('libs/cli/', ''))]),
    );
  if (node.length) statuses.push(run('node', ['--test', ...node]));

  return statuses.every((status) => status === 0) ? 0 : 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const map = JSON.parse(readFileSync(join(root, 'tools/scripts/data-spec-map.json'), 'utf8'));
  const specs = specsForData(process.argv.slice(2), map);

  process.exit(specs.length ? runSpecs(specs) : 0);
}
