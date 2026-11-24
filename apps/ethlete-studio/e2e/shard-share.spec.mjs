import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runOrderOf, shardShareOf } from './shard-share.mjs';
import { SHARD_WEIGHTS_FILE } from './shard-weights.mjs';
import { STANDALONE_FILES, STANDALONE_PAGE } from './standalone-jobs.mjs';

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

test('every shard gets about the same measured time, not the same count', () => {
  const queue = jobsOf('System', ['slow', 'a', 'b', 'c', 'd']);
  const weights = { 'System :: slow': 40, 'System :: a': 10, 'System :: b': 10, 'System :: c': 10, 'System :: d': 10 };

  assert.deepEqual(
    Array.from({ length: 2 }, (_, at) => shardShareOf(queue, { index: at + 1, count: 2 }, keyOf, weights).map(keyOf)),
    [['System :: slow'], ['System :: a', 'System :: b', 'System :: c', 'System :: d']],
  );
});

test('a job without a weight counts as the median weight', () => {
  const queue = jobsOf('System', ['new', 'a', 'b', 'c']);
  const weights = { 'System :: a': 30, 'System :: b': 5, 'System :: c': 5 };
  const shares = Array.from({ length: 2 }, (_, at) =>
    shardShareOf(queue, { index: at + 1, count: 2 }, keyOf, weights).map(keyOf),
  );

  assert.deepEqual(shares, [['System :: a'], ['System :: new', 'System :: b', 'System :: c']]);
});

test('the real case list splits into shards within 10 % of the mean measured time', () => {
  const runner = fileURLToPath(new URL('./canvas.e2e.mjs', import.meta.url));
  const weights = JSON.parse(readFileSync(SHARD_WEIGHTS_FILE, 'utf8'));
  const loads = [1, 2, 3, 4, 5, 6].map((index) =>
    execFileSync(process.execPath, [runner, '--list'], {
      encoding: 'utf8',
      env: { ...process.env, STUDIO_E2E_SHARD: `${index}/9` },
    })
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => line.replace(/^\s*[\d.]+s {2}(\S+)\s+/, '$1 :: '))
      .reduce((sum, key) => sum + (weights[key] ?? 0), 0),
  );
  const mean = loads.reduce((sum, load) => sum + load, 0) / loads.length;

  assert.ok(
    Math.max(...loads) <= mean * 1.1,
    `shard loads ${loads.map((load) => load.toFixed(0)).join(' ')} s, mean ${mean.toFixed(0)} s`,
  );
});

test('every standalone e2e file runs in exactly one of the 9 shards', () => {
  const runner = fileURLToPath(new URL('./canvas.e2e.mjs', import.meta.url));
  const listed = [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((index) =>
    execFileSync(process.execPath, [runner, '--list'], {
      encoding: 'utf8',
      env: { ...process.env, STUDIO_E2E_SHARD: `${index}/9` },
    })
      .split('\n')
      .filter((line) => line.includes(` ${STANDALONE_PAGE} `))
      .map((line) => line.trim().split(/\s+/).at(-1)),
  );

  assert.deepEqual(listed.toSorted(), STANDALONE_FILES.map(({ file }) => file).toSorted());
});

test('each ownShard job runs alone in one of the last shards', () => {
  const queue = [...jobsOf('System', ['a', 'heavy', 'b']), { page: 'System', name: 'heavy2', ownShard: true }];
  const shares = sharesOf(queue, 4);

  assert.deepEqual(shares.slice(2), [['System :: heavy'], ['System :: heavy2']]);
  assert.deepEqual(shares.slice(0, 2).flat().toSorted(), ['System :: a', 'System :: b']);
});

test('more ownShard jobs than shards share the last shard', () => {
  const queue = [...jobsOf('System', ['a']), ...['h1', 'h2'].map((name) => ({ page: 'System', name, ownShard: true }))];

  assert.deepEqual(sharesOf(queue, 2), [['System :: a'], ['System :: h1', 'System :: h2']]);
});

test('a single shard runs every job', () => {
  const queue = jobsOf('System', ['a', 'heavy']);

  assert.deepEqual(sharesOf(queue, 1), [['System :: a', 'System :: heavy']]);
});

test('without local timings, the real shard 1 starts its heaviest CI-weighted job first, not the standalone file it appends last', () => {
  const runner = fileURLToPath(new URL('./canvas.e2e.mjs', import.meta.url));
  const weights = JSON.parse(readFileSync(SHARD_WEIGHTS_FILE, 'utf8'));
  const keys = execFileSync(process.execPath, [runner, '--list'], {
    encoding: 'utf8',
    env: { ...process.env, STUDIO_E2E_SHARD: '1/9' },
  })
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.replace(/^\s*[\d.]+s {2}(\S+)\s+/, '$1 :: '))
    .filter((key) => key in weights);
  const queue = [
    ...keys.filter((key) => !key.startsWith(`${STANDALONE_PAGE} :: `)),
    ...keys.filter((key) => key.startsWith(`${STANDALONE_PAGE} :: `)),
  ].map((key) => ({ key }));
  const heaviest = keys.toSorted((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))[0];

  assert.equal(runOrderOf(queue, (job) => job.key, { weights })[0].key, heaviest);
});
