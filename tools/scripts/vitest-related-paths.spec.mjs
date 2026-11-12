import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const project = resolve(root, 'libs/eslint-plugin');

test('vitest related refuses the rest of a shell chain before it runs', () => {
  const run = spawnSync(
    process.execPath,
    [resolve(root, 'node_modules/vitest/vitest.mjs'), 'related', '--run', 'vitest.config.mts', '&&', 'cd', '../cli'],
    { cwd: project, encoding: 'utf8', timeout: 120_000 },
  );

  assert.equal(run.status, 2);
  assert.equal(
    run.stderr.trim(),
    'vitest related: not an existing path: "&&" "cd" - pass only files (an option value as --flag=value)',
  );
  assert.doesNotMatch(run.stdout, /RUN/);
});

test('vitest related keeps an option value and an existing path', async () => {
  const { missingRelatedPathsOf } = await import('../vitest/related-paths.mjs');

  assert.deepEqual(
    missingRelatedPathsOf(['node', 'vitest', 'related', '--run', '-t', 'some name', 'vitest.config.mts'], project),
    [],
  );
  assert.deepEqual(missingRelatedPathsOf(['node', 'vitest', 'run', 'nope'], project), []);
});
