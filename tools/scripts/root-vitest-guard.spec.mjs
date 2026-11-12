import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');

test('vitest at the repo root refuses to run and names the project dir', () => {
  const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'list', '--filesOnly'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
  });

  assert.notEqual(run.status, 0);
  assert.match(`${run.stdout}${run.stderr}`, /the repo root runs no specs\. Run vitest in the project dir/);
});
