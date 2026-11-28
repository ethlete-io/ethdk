import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  MAX_LOAD_WAIT_MS,
  medianOf,
  p50Of,
  runWebkitZoomStep,
  webkitZoomPlan,
  WEBKIT_ZOOM_CASE,
} from './webkit-zoom-step.mjs';

const caseOutput = (p50) => `ok webkit, 100 cells, frame interval p50 ${p50.toFixed(1)} ms (<= 20), p95 30.0 ms`;

const fakeTank = ({ p50s, loads = [1] }) => {
  let clock = 0;
  let loadIndex = 0;
  const runs = [...p50s];
  const cwds = [];
  const removed = [];
  return {
    runCaptured: async (_command, _args, options) => {
      cwds.push(options?.cwd);
      return caseOutput(runs.shift());
    },
    makeScratch: () => 'scratch-dir',
    removeScratch: (dir) => removed.push(dir),
    cwds,
    removed,
    load: () => loads[Math.min(loadIndex++, loads.length - 1)],
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    elapsed: () => clock,
  };
};

test('the plan runs the WebKit zoom case on tank with the perf flag', () => {
  const { command, args } = webkitZoomPlan();
  assert.equal(command, 'node');
  assert.ok(args.join(' ').includes('heavy.mjs run --on tank -- yarn studio:e2e --perf --engine webkit --case'));
  assert.equal(args.at(-1), WEBKIT_ZOOM_CASE);
});

test('p50 is read from the case detail and the median takes the middle run', () => {
  assert.equal(p50Of(caseOutput(19)), 19);
  assert.equal(p50Of('no number'), null);
  assert.equal(medianOf([22, 19, 20]), 20);
});

test('one loaded run over budget does not fail a median within budget', async () => {
  assert.equal(await runWebkitZoomStep(fakeTank({ p50s: [19, 22, 20] })), null);
});

test('a slow zoom fails the median, naming the numbers, the load and B910', async () => {
  const message = await runWebkitZoomStep(fakeTank({ p50s: [24, 21, 30], loads: [3] }));
  assert.match(message, /median p50 24 ms > 20 ms/);
  assert.match(message, /@ load 3\.0/);
  assert.match(message, /B910/);
});

test('a run without a p50 fails the step', async () => {
  const tank = fakeTank({ p50s: [19, 19, 19] });
  const message = await runWebkitZoomStep({ ...tank, runCaptured: async () => 'crashed' });
  assert.match(message, /printed no p50/);
});

test('a busy tank delays each run, but at most the bounded wait', async () => {
  const tank = fakeTank({ p50s: [19, 19, 19], loads: [20] });
  assert.equal(await runWebkitZoomStep(tank), null);
  assert.ok(tank.elapsed() >= 3 * MAX_LOAD_WAIT_MS);
  assert.ok(tank.elapsed() < 3 * (MAX_LOAD_WAIT_MS + 15_000));
});

test('smoke.mjs runs the step and fails the smoke on its message', () => {
  const smoke = readFileSync(new URL('./smoke.mjs', import.meta.url), 'utf8');
  assert.match(smoke, /runWebkitZoomStep\(\)/);
  assert.match(smoke, /webkitFailure/);
});

test('all runs happen in one scratch copy that is removed afterwards, also after a throw', async () => {
  const tank = fakeTank({ p50s: [19, 19, 19] });
  await runWebkitZoomStep(tank);
  assert.deepEqual(tank.cwds, ['scratch-dir', 'scratch-dir', 'scratch-dir']);
  assert.deepEqual(tank.removed, ['scratch-dir']);

  const broken = fakeTank({ p50s: [] });
  await assert.rejects(runWebkitZoomStep({ ...broken, runCaptured: async () => Promise.reject(new Error('x')) }));
  assert.deepEqual(broken.removed, ['scratch-dir']);
});
