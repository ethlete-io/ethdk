import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { noMatchLineOf } from './case-filter.mjs';

test('a filter that matches no case names the closest case names first', () => {
  const line = noMatchLineOf({
    flag: '--case',
    only: 'sketch merge view',
    names: ['tab focus shows the ring', 'a sketch merged while its view is open', 'a sketch discarded'],
  });

  assert.equal(
    line,
    '--case "sketch merge view" matches no case; closest names:\n  a sketch merged while its view is open\n  a sketch discarded\n  tab focus shows the ring',
  );
});

test('a run whose filter matches no case exits 2 (refused, not failed) with the line and no pass summary', () => {
  const run = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./canvas.e2e.mjs', import.meta.url)), '--case', 'zz-matches-no-case'],
    { encoding: 'utf8', timeout: 30_000 },
  );

  assert.equal(run.status, 2);
  assert.match(run.stderr, /^--case "zz-matches-no-case" matches no case; closest names:/);
  assert.doesNotMatch(run.stdout + run.stderr, /passed/);
});
