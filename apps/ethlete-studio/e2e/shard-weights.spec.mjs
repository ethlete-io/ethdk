import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { caseTimesOf, weightsOf } from './shard-weights.mjs';

const log = readFileSync(new URL('./fixtures/studio-e2e-case-times.log', import.meta.url), 'utf8');

test('a CI log yields every row of its per-case time table and nothing after it', () => {
  const rows = caseTimesOf(log);

  assert.equal(rows.length, 28);
  assert.deepEqual(rows[0], {
    key: 'System :: focus inside a live frame stays on the frame across its remount',
    seconds: 63.5,
  });
  assert.deepEqual(rows.at(-1), { key: 'Inbox :: Tab focus shows the ring', seconds: 5.2 });
});

test('the weight of a case is its median time over the logs', () => {
  const slower = log.replace('  63.5s  System', '  80.1s  System');
  const faster = log.replace('  63.5s  System', '  40.0s  System');

  assert.equal(
    weightsOf([log, slower, faster])['System :: focus inside a live frame stays on the frame across its remount'],
    63.5,
  );
});
