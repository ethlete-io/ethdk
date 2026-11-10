import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  affectedCases,
  caseSpans,
  changedLines,
  DELAY_PICTURES_MS,
  HOLD_LISTINGS_MS,
  keyOf,
  runOnce,
  parseList,
  parseResults,
  repeatVerdict,
  RUNS,
  runArgs,
  TRIGGERS,
} from './studio-e2e-repeat.mjs';

const fixture = (name) => readFileSync(join(import.meta.dirname, 'fixtures/studio-e2e-repeat', name), 'utf8');
const RUNNER = 'apps/ethlete-studio/e2e/canvas.e2e.mjs';
const spans = JSON.parse(fixture('case-spans-2bb8d3d58.json'));
const jobs = parseList(fixture('list.txt'));
const stable = parseResults(fixture('run-stable.txt'), jobs);
const held = parseResults(fixture('run-hold.txt'), jobs);
const MERGE = 'Merge  a sketch merged while its view is open opens the part view of the target';

test('the 2bb8d3d58 fixture change reaches outside the cases, so every page group runs', () => {
  const verdict = affectedCases(changedLines(fixture('fixture-change-2bb8d3d58.diff')), spans);

  assert.equal(verdict.all, true);
  assert.match(verdict.reasons[0], /line 43 is outside a case/);
});

test('hunks inside the cases name only those cases', () => {
  const lines = changedLines(fixture('fixture-change-2bb8d3d58.diff')).get(RUNNER);
  const inCases = lines.filter((line) => line >= 1312 && line <= 2229);
  const verdict = affectedCases(new Map([[RUNNER, inCases]]), spans);

  assert.equal(verdict.all, false);
  assert.ok(verdict.cases.length >= 1 && verdict.cases.length <= 4);
  assert.ok(verdict.cases.every((name) => spans.some((span) => span.name === name)));
});

test('a shared server file runs every page group, a file outside the triggers none', () => {
  assert.equal(affectedCases(new Map([['libs/cli/src/lib/design/serve.ts', [10]]]), spans).all, true);
  assert.equal(affectedCases(new Map([['libs/cli/src/lib/design/studio-api.ts', [10]]]), spans).all, true);
  assert.deepEqual(affectedCases(new Map([['libs/cli/src/lib/design/other.ts', [10]]]), spans), {
    all: false,
    cases: [],
    reasons: [],
  });
  assert.deepEqual(TRIGGERS, [RUNNER, 'libs/cli/src/lib/design/serve.ts', 'libs/cli/src/lib/design/studio-api.ts']);
});

test('reads every case of the current runner with its name', () => {
  const current = caseSpans(readFileSync(join(import.meta.dirname, '../..', RUNNER), 'utf8'));

  assert.ok(current.length > 30);
  assert.ok(current.every((span) => span.name && span.end > span.start));
});

test('reads the listed jobs and the results of a real run', () => {
  assert.deepEqual(jobs.map((job) => job.page).sort(), ['Merge', 'Wide', 'Wide']);
  assert.deepEqual([...stable.values()], ['pass', 'pass', 'pass']);
  assert.deepEqual([...held.values()], ['pass', 'pass', 'pass']);
  assert.equal(held.size, 3);
});

test('reads a failed and a not-run row in the list format', () => {
  const output =
    fixture('run-stable.txt').replace('  ✓  3 [Merge]', '  ✘  3 [Merge]') + 'NOT RUN  Wide      other case\n';
  const results = parseResults(output, [...jobs, { page: 'Wide', name: 'other case' }]);

  assert.equal(results.get(MERGE), 'fail');
  assert.equal(results.get('Wide  other case'), 'not run');
});

test('reads the fail rows of a quiet-tail run that carry the machine load', () => {
  const quietJobs = parseList(fixture('list-quiet-tail.txt'));
  const results = parseResults(fixture('run-quiet-tail-fail.txt'), quietJobs);

  assert.equal(results.size, 13);
  assert.deepEqual(
    quietJobs.filter((job) => results.get(keyOf(job)) === 'fail').map((job) => job.name),
    Array(4).fill('hover alone draws no frame border'),
  );
});

test('stable runs pass the gate', () => {
  const verdict = repeatVerdict(jobs, [
    { hold: false, results: stable },
    { hold: false, results: stable },
    { hold: true, results: stable },
  ]);

  assert.equal(verdict.blocks, false);
});

test('a result that flips between the plain runs blocks', () => {
  const flipped = new Map([...stable, [MERGE, 'fail']]);
  const verdict = repeatVerdict(jobs, [
    { hold: false, results: stable },
    { hold: false, results: flipped },
    { hold: true, results: stable },
  ]);

  assert.equal(verdict.blocks, true);
  assert.deepEqual(verdict.changed.map(keyOf), [MERGE]);
  assert.deepEqual(verdict.holdFailed, []);
});

test('a failure in the hold run blocks, also when it fails every run', () => {
  const failing = new Map([...stable, [MERGE, 'fail']]);
  const verdict = repeatVerdict(jobs, [
    { hold: false, results: failing },
    { hold: false, results: failing },
    { hold: true, results: failing },
  ]);

  assert.equal(verdict.blocks, true);
  assert.deepEqual(verdict.changed, []);
  assert.deepEqual(verdict.holdFailed.map(keyOf), [MERGE]);
});

test('a case missing from one run counts as changed', () => {
  const missing = new Map([...stable].filter(([key]) => key !== MERGE));
  const verdict = repeatVerdict(jobs, [
    { hold: false, results: stable },
    { hold: false, results: missing },
    { hold: true, results: stable },
  ]);

  assert.deepEqual(verdict.changed[0].results, ['pass', 'not run', 'pass']);
});

test('only the hold run holds the listings and delays the pictures', () => {
  const runs = Array.from({ length: RUNS }, (_, at) => runArgs(at, ['--page', 'Large'], '/built'));

  assert.ok(DELAY_PICTURES_MS > 0);
  assert.deepEqual(runs.at(-1), [
    '--page',
    'Large',
    '--built',
    '/built',
    '--hold-listings',
    String(HOLD_LISTINGS_MS),
    '--delay-pictures',
    String(DELAY_PICTURES_MS),
  ]);
  for (const args of runs.slice(0, -1)) assert.deepEqual(args, ['--page', 'Large', '--built', '/built']);
});

test('the hold run delays the pictures of the sketch edit case but never holds its listings', () => {
  const holdArgs = runArgs(RUNS - 1, [], '/built').filter((arg) => arg !== '--built' && arg !== '/built');
  const listed = spawnSync(process.execPath, ['apps/ethlete-studio/e2e/canvas.e2e.mjs', '--list', ...holdArgs], {
    cwd: join(import.meta.dirname, '../..'),
    encoding: 'utf8',
  }).stdout;
  const row = listed
    .split('\n')
    .find((line) => line.includes('keeps its frame count and pictures through a sketch edit'));

  assert.ok(row?.includes('[listings not held]'), row);
  assert.ok(!row.includes('[pictures not delayed]'), row);
});

test('each repeat run writes its runner output to a fresh live log for the e2e-progress mod', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'repeat-live-log-'));
  const runner = join(dir, 'runner.mjs');
  const liveLog = join(dir, 'handoffs/push-suite-repeat.log');
  writeFileSync(
    runner,
    `console.log('Running 1 test using 1 worker\\n  ✓  1 [Large] › ' + process.argv[2] + ' (1.0s)');`,
  );

  await runOnce(runner, ['first'], dir, liveLog);
  const output = await runOnce(runner, ['second'], dir, liveLog);

  assert.match(output, /second/);
  assert.equal(readFileSync(liveLog, 'utf8'), 'Running 1 test using 1 worker\n  ✓  1 [Large] › second (1.0s)\n');
});
