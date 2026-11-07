import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArgs, summarize } from './spec-stress.mjs';

test('parseArgs reads specs, runs and load', () => {
  assert.deepEqual(parseArgs(['a.spec.ts', 'b.spec.mjs', '--runs', '4', '--load', '2']), {
    specs: ['a.spec.ts', 'b.spec.mjs'],
    runs: 4,
    load: 2,
  });
});

test('parseArgs defaults runs to 8', () => {
  assert.equal(parseArgs(['a.spec.ts']).runs, 8);
});

test('parseArgs rejects bad input', () => {
  assert.throws(() => parseArgs([]), /at least one spec/);
  assert.throws(() => parseArgs(['a', '--runs', '0']), /integer/);
  assert.throws(() => parseArgs(['a', '--runs', 'x']), /integer/);
  assert.throws(() => parseArgs(['a', '--nope']), /unknown option/);
});

test('summarize separates flaky from broken', () => {
  const summary = summarize([
    { spec: 'flaky', ok: true },
    { spec: 'flaky', ok: false },
    { spec: 'broken', ok: false },
    { spec: 'broken', ok: false },
    { spec: 'fine', ok: true },
  ]);
  assert.deepEqual(
    summary.flaky.map((s) => s.spec),
    ['flaky'],
  );
  assert.deepEqual(
    summary.broken.map((s) => s.spec),
    ['broken'],
  );
  assert.equal(summary.ok, false);
});

test('summarize is ok when every run passes', () => {
  assert.equal(summarize([{ spec: 'a', ok: true }]).ok, true);
});
