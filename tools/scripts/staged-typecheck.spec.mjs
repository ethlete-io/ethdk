import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { linkNodeModules, typecheckCommands } from './staged-typecheck.mjs';

const projects = {
  'libs/cli/project.json': { name: 'cli', targets: { typecheck: { options: { command: 'tsc -p libs/cli' } } } },
  'apps/ethlete-studio/project.json': {
    name: 'ethlete-studio',
    targets: { typecheck: { options: { command: 'ngc -p apps/ethlete-studio' } } },
  },
  'libs/core/project.json': { name: 'core', targets: {} },
};
const read = (path) => JSON.stringify(projects[path]);
const exists = (path) => path in projects;

test('maps staged source files to the typecheck command of each touched project once', () => {
  const files = ['apps/ethlete-studio/src/a.ts', 'apps/ethlete-studio/src/b.ts', 'libs/cli/src/c.ts'];

  assert.deepEqual(typecheckCommands(files, read, exists), [
    { name: 'cli', command: 'tsc -p libs/cli' },
    { name: 'ethlete-studio', command: 'ngc -p apps/ethlete-studio' },
  ]);
});

test('skips projects without a typecheck target, non-source files and paths outside apps and libs', () => {
  assert.deepEqual(
    typecheckCommands(['libs/core/src/a.ts', 'libs/cli/README.md', 'tools/x.ts', 'a.ts'], read, exists),
    [],
  );
});

test('links node_modules only into projects the staged tree holds', () => {
  const base = mkdtempSync(join(tmpdir(), 'staged-typecheck-spec-'));
  try {
    const from = join(base, 'work');
    const to = join(base, 'staged');
    for (const dir of ['node_modules', 'apps', 'libs/app-a/node_modules', 'libs/app-b/node_modules'])
      mkdirSync(join(from, dir), { recursive: true });
    mkdirSync(join(to, 'libs/app-a'), { recursive: true });
    linkNodeModules(from, to);
    assert.ok(existsSync(join(to, 'libs/app-a/node_modules')));
    assert.ok(!existsSync(join(to, 'libs/app-b')));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
