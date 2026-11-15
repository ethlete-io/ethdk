import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { specFilesOf } from './spec-files.mjs';
import { tempDir } from './temp-dir.mjs';

const tracked = [
  'pkg/src/a.spec.ts',
  'pkg/src/lib/b.spec.ts',
  'pkg/src/lib/b.proof.spec.ts',
  'pkg/src/lib/c.perf.spec.ts',
  'pkg/scripts/d.spec.mts',
  'pkg/node_modules/x/e.spec.ts',
  'other/src/f.spec.ts',
];

const repoWith = (config) => {
  const repo = tempDir('spec-files-');
  mkdirSync(join(repo, 'pkg'));
  writeFileSync(join(repo, 'pkg', 'vitest.config.mts'), config);
  return repo;
};

test('lists the files include selects and leaves out the files exclude names', async () => {
  const repo = repoWith(
    `export default { test: { include: ['src/**/*.spec.ts', 'scripts/**/*.spec.mts'], exclude: ['**/node_modules/**', 'src/**/*.proof.spec.ts', 'src/**/*.perf.spec.ts'] } };`,
  );

  assert.deepEqual(await specFilesOf('pkg/vitest.config.mts', tracked, repo), [
    'pkg/src/a.spec.ts',
    'pkg/src/lib/b.spec.ts',
    'pkg/scripts/d.spec.mts',
  ]);
});

test('without an exclude, node_modules stays out', async () => {
  const repo = repoWith(`export default { test: { include: ['src/**/*.spec.ts', '**/e.spec.ts'] } };`);

  assert.ok(!(await specFilesOf('pkg/vitest.config.mts', tracked, repo)).includes('pkg/node_modules/x/e.spec.ts'));
});

test('a config without include is an error', async () => {
  const repo = repoWith(`export default { test: {} };`);

  await assert.rejects(specFilesOf('pkg/vitest.config.mts', tracked, repo), /no test\.include/);
});
