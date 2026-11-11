import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpuQuotaOf, parseArgs, reportLines, runPooled, slowed, summarize } from './spec-stress.mjs';

test('parseArgs reads specs, runs and load', () => {
  assert.deepEqual(parseArgs(['a.spec.ts', 'b.spec.mjs', '--runs', '4', '--load', '2']), {
    specs: ['a.spec.ts', 'b.spec.mjs'],
    runs: 4,
    load: 2,
    slow: 0,
    jobs: 0,
    github: false,
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

test('parseArgs reads a slow factor above 1', () => {
  assert.equal(parseArgs(['a', '--slow', '13']).slow, 13);
  assert.throws(() => parseArgs(['a', '--slow', '1']), /above 1/);
  assert.throws(() => parseArgs(['a', '--slow', 'x']), /above 1/);
});

test('slowed runs the command in a user scope with a CPU quota of one core divided by the factor', () => {
  assert.equal(cpuQuotaOf(13), '8%');
  assert.equal(cpuQuotaOf(500), '1%');
  assert.deepEqual(slowed(['npx', ['vitest', 'run']], 4), [
    'systemd-run',
    ['--user', '--scope', '--quiet', '-p', 'CPUQuota=25%', 'npx', 'vitest', 'run'],
  ]);
  assert.deepEqual(slowed(['npx', ['vitest']], 0), ['npx', ['vitest']]);
});

test('parseArgs reads a job limit and the GitHub annotation switch', () => {
  const options = parseArgs(['a', '--jobs', '12', '--github']);
  assert.equal(options.jobs, 12);
  assert.equal(options.github, true);
  assert.throws(() => parseArgs(['a', '--jobs', '0']), /above 0/);
});

test('runPooled never runs more jobs at once than the limit and keeps the order', async () => {
  let running = 0;
  let peak = 0;
  const results = await runPooled([1, 2, 3, 4, 5], 2, async (n) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running--;
    return n * 10;
  });
  assert.equal(peak, 2);
  assert.deepEqual(results, [10, 20, 30, 40, 50]);
});

test('runPooled without a limit starts every job at once', async () => {
  let running = 0;
  let peak = 0;
  await runPooled([1, 2, 3], 0, async () => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running--;
  });
  assert.equal(peak, 3);
});

test('reportLines annotates each file under 100 % for GitHub, and only with --github', () => {
  const summary = summarize([
    { spec: 'a.spec.ts', ok: true, ms: 1200 },
    { spec: 'a.spec.ts', ok: false, ms: 31000 },
    { spec: 'b.spec.ts', ok: true, ms: 800 },
  ]);
  assert.deepEqual(reportLines(summary, { slow: 4, github: true }), [
    'FAIL a.spec.ts: 1/2 passed, slowest 31.0 s',
    '::error file=a.spec.ts,title=spec:stress::a.spec.ts 1/2 passed under --slow 4',
    'ok   b.spec.ts: 1/1 passed, slowest 0.8 s',
  ]);
  assert.equal(
    reportLines(summary, { slow: 4, github: false }).some((l) => l.startsWith('::')),
    false,
  );
});
