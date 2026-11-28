import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchesGlob } from './related-map.mjs';
import { gitEnv } from './git-test-env.mjs';

const root = join(fileURLToPath(import.meta.url), '../../..');

export const specsForData = (files, map) =>
  Object.entries(map)
    .filter(([, globs]) => files.some((file) => globs.some((glob) => matchesGlob(file, glob))))
    .map(([spec]) => spec);

// A hook runs with GIT_DIR and GIT_INDEX_FILE set; specs that `git init` a temp repo would otherwise write into this one.
const run = (command, args) => spawnSync(command, args, { cwd: root, stdio: 'inherit', env: gitEnv() }).status ?? 1;

const LIB_SPEC = /^(libs\/[^/]+)\/(.+\.spec\.ts)$/;

export const specCommands = (specs) => {
  const byLib = new Map();

  for (const [, lib, spec] of specs.map((path) => LIB_SPEC.exec(path)).filter(Boolean))
    byLib.set(lib, [...(byLib.get(lib) ?? []), spec]);

  const node = specs.filter((spec) => spec.endsWith('.spec.mjs'));

  return [
    ...[...byLib].map(([lib, libSpecs]) => ['npx', ['vitest', 'run', '--root', lib, ...libSpecs]]),
    ...(node.length ? [['node', ['--test', ...node]]] : []),
  ];
};

export const runSpecs = (specs) =>
  specCommands(specs)
    .map(([command, args]) => run(command, args))
    .every((status) => status === 0)
    ? 0
    : 1;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const map = JSON.parse(readFileSync(join(root, 'tools/scripts/data-spec-map.json'), 'utf8'));
  const specs = specsForData(process.argv.slice(2), map);

  process.exit(specs.length ? runSpecs(specs) : 0);
}
