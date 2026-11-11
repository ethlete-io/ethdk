import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstListingStep, firstListingVerdict } from './first-listing-time.mjs';

const samples = (...seconds) => seconds.map((s) => ({ ms: s * 1000, listed: 6 }));

const harness = ({ head, base }) => {
  const loops = [];
  const order = [];
  const removed = [];
  const sampler = (name, measured) => {
    const queue = measured instanceof Error ? measured : [...measured];
    return async () => {
      assert.equal(loops.filter((loop) => !loop.stopped).length, 1);
      order.push(name);
      if (queue instanceof Error) throw queue;
      return queue.shift();
    };
  };
  return {
    loops,
    order,
    removed,
    options: {
      taskset: true,
      measure: sampler('head', head),
      prepareBase: async () => {
        if (base instanceof Error && base.message.startsWith('build')) throw base;
        return { measure: sampler('base', base), remove: () => removed.push(true) };
      },
      busy: async (count) => {
        const loop = { count, stopped: false };
        loops.push(loop);
        return { ok: true, stop: () => (loop.stopped = true) };
      },
    },
  };
};

const design = ['libs/cli/src/lib/design/studio-api.ts'];

test('a loaded machine where base and head are both slow passes', async () => {
  const run = harness({ base: samples(18.52, 16.58, 15.63), head: samples(20.43, 18.28, 15.97) });
  const result = await firstListingStep(design, run.options);

  assert.equal(result.status, 0);
  assert.deepEqual(run.order, ['base', 'head', 'base', 'head', 'base', 'head']);
  assert.match(result.output, /median head 18\.28 s .* vs base 16\.58 s/);
  assert.match(result.output, /max\(3 s, 20 %\) = 3\.32 s; passed, head and base over the 15\.00 s reference/);
});

test('a head clearly slower than base fails', async () => {
  const run = harness({ base: samples(6, 7, 6.5), head: samples(11, 10.5, 12) });
  const result = await firstListingStep(design, run.options);

  assert.equal(result.status, 1);
  assert.match(result.output, /FAILED, both under the 15\.00 s reference/);
});

test('a head slower by less than 20 % of a slow base passes', () => {
  assert.equal(firstListingVerdict(samples(20, 20, 20), samples(23.9, 23.9, 23.9)).ok, true);
  assert.equal(firstListingVerdict(samples(20, 20, 20), samples(24.1, 24.1, 24.1)).ok, false);
});

test('a base that fails to build fails the step before the load starts', async () => {
  const run = harness({ base: new Error('build of base abc failed'), head: samples(5, 5, 5) });
  const result = await firstListingStep(design, run.options);

  assert.equal(result.status, 1);
  assert.match(result.output, /^the base measure failed: build of base abc failed/);
  assert.equal(run.loops.length, 0);
});

test('a base listing that throws fails the step, stops the load and removes the base', async () => {
  const run = harness({ base: new Error('the design server exited with 1'), head: samples(5, 5, 5) });
  const result = await firstListingStep(design, run.options);

  assert.equal(result.status, 1);
  assert.match(result.output, /^the base measure failed: the design server exited with 1/);
  assert.equal(run.loops[0].stopped, true);
  assert.equal(run.removed.length, 1);
});

test('a head listing that throws fails the step', async () => {
  const run = harness({ base: samples(5, 5, 5), head: new Error('the design server exited with 1') });
  const result = await firstListingStep(design, run.options);

  assert.equal(result.status, 1);
  assert.match(result.output, /^the head measure failed/);
});

test('a listing that answers no sketch fails on either side', () => {
  const empty = [{ ms: 100, listed: 0 }];

  assert.match(firstListingVerdict(samples(5), empty).line, /on head answered no sketch/);
  assert.equal(firstListingVerdict(empty, samples(5)).ok, false);
});

test('the step times the listings beside the CI-like busy loops and stops them after', async () => {
  const run = harness({ base: samples(5, 5, 5), head: samples(5, 5, 5) });
  const result = await firstListingStep(design, run.options);

  assert.equal(run.loops.length, 1);
  assert.equal(run.loops[0].count, 12);
  assert.equal(run.loops[0].stopped, true);
  assert.equal(run.removed.length, 1);
  assert.match(result.note, /^CI-like: 12 busy loops, pinned to cores 0-3$/);
});

test('the step is skipped without a design server change', async () => {
  const run = harness({ base: samples(5), head: samples(29) });
  const result = await firstListingStep(['apps/ethlete-studio/src/a.ts'], run.options);

  assert.equal(result.status, 0);
  assert.equal(run.loops.length, 0);
});
