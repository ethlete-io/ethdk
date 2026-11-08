import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  affectedCases,
  caseSpans,
  changedLines,
  keyOf,
  parseList,
  parseResults,
  repeatVerdict,
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
  assert.equal(held.get(MERGE), 'fail');
  assert.equal(held.size, 3);
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
    { hold: true, results: held },
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
