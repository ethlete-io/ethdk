import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { caseTimesOf, ciLogs, weightsOf } from './shard-weights.mjs';

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

test('a job log from gh run view --job keeps its rows behind the job and step columns', () => {
  const jobLog = log
    .split('\n')
    .map((line) => `ci / Studio e2e (9/9)\tUNKNOWN STEP\t${line}`)
    .join('\n');

  assert.deepEqual(caseTimesOf(jobLog), caseTimesOf(log));
});

test('the weight of a case is its median time over the logs', () => {
  const slower = log.replace('  63.5s  System', '  80.1s  System');
  const faster = log.replace('  63.5s  System', '  40.0s  System');

  assert.equal(
    weightsOf([log, slower, faster])['System :: focus inside a live frame stays on the frame across its remount'],
    63.5,
  );
});

test('the CI mode reads the log of every Studio e2e job of the last successful runs', () => {
  const calls = [];
  const run = (args) => {
    calls.push(args.join(' '));
    if (args[1] === 'list') return JSON.stringify([{ databaseId: 1 }, { databaseId: 2 }]);
    if (args.includes('--json')) {
      return JSON.stringify({
        jobs: [
          { name: 'ci / Studio e2e (1/9)', databaseId: Number(args[2]) * 10 },
          { name: 'ci / lint', databaseId: 99 },
        ],
      });
    }

    return log;
  };

  const logs = ciLogs(2, run);

  assert.equal(logs.length, 2);
  assert.deepEqual(
    calls.filter((call) => call.includes('--log')),
    ['run view --job 10 --log', 'run view --job 20 --log'],
  );
  assert.equal(weightsOf(logs)['Inbox :: Tab focus shows the ring'], 5.2);
});
