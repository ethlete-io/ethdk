import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shardShareOf } from './shard-share.mjs';

const keyOf = (job) => `${job.page} :: ${job.name}`;
const jobsOf = (page, names) => names.map((name) => ({ page, name, ownShard: name === 'heavy' }));
const sharesOf = (queue, count) =>
  Array.from({ length: count }, (_, at) => shardShareOf(queue, { index: at + 1, count }, keyOf).map(keyOf));

test('an ownShard job runs alone in the last shard and the others deal over the shards before it', () => {
  const queue = [...jobsOf('System', ['a', 'heavy', 'b', 'c']), ...jobsOf('Chip', ['d', 'e'])];
  const shares = sharesOf(queue, 3);

  assert.deepEqual(shares[2], ['System :: heavy']);
  assert.deepEqual(
    shares.slice(0, 2).flat().toSorted(),
    queue
      .filter((job) => !job.ownShard)
      .map(keyOf)
      .toSorted(),
  );
  assert.ok(shares[0].length && shares[1].length);
});

test('without an ownShard job every shard deals the jobs back and forth per page', () => {
  const queue = jobsOf('System', ['a', 'b', 'c', 'd', 'e']);

  assert.deepEqual(sharesOf(queue, 2), [
    ['System :: a', 'System :: d', 'System :: e'],
    ['System :: b', 'System :: c'],
  ]);
});

test('a single shard runs every job', () => {
  const queue = jobsOf('System', ['a', 'heavy']);

  assert.deepEqual(sharesOf(queue, 1), [['System :: a', 'System :: heavy']]);
});
