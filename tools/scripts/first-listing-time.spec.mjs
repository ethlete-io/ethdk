import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FIRST_LISTING_LIMIT_MS, firstListingStep, firstListingVerdict } from './first-listing-time.mjs';

const harness = (measured) => {
  const loops = [];
  return {
    loops,
    options: {
      taskset: true,
      measure: async () => {
        assert.equal(loops.filter((loop) => !loop.stopped).length, 1);
        if (measured instanceof Error) throw measured;
        return measured;
      },
      busy: async (count) => {
        const loop = { count, stopped: false };
        loops.push(loop);
        return { ok: true, stop: () => (loop.stopped = true) };
      },
    },
  };
};

test('a first listing under the limit passes and one at or over it fails', () => {
  assert.equal(firstListingVerdict({ ms: FIRST_LISTING_LIMIT_MS - 1, listed: 6 }).ok, true);
  assert.equal(firstListingVerdict({ ms: FIRST_LISTING_LIMIT_MS, listed: 6 }).ok, false);
  assert.match(firstListingVerdict({ ms: 28_700, listed: 6 }).line, /took 28\.70 s for 6 sketches, limit 15\.00 s/);
});

test('a fast listing that answers no sketch fails', () => {
  const verdict = firstListingVerdict({ ms: 100, listed: 0 });

  assert.equal(verdict.ok, false);
  assert.match(verdict.line, /answered no sketch/);
});

test('the step times the listing beside the CI-like busy loops and stops them after', async () => {
  const { loops, options } = harness({ ms: 29_000, listed: 6 });
  const result = await firstListingStep(['libs/cli/src/lib/design/studio-api.ts'], options);

  assert.equal(result.status, 1);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].count, 12);
  assert.equal(loops[0].stopped, true);
  assert.match(result.note, /^CI-like: 12 busy loops, pinned to cores 0-3$/);
});

test('the step passes a fast listing and fails a measurement that throws', async () => {
  assert.equal(
    (await firstListingStep(['libs/cli/src/lib/design/a.ts'], harness({ ms: 9_000, listed: 6 }).options)).status,
    0,
  );

  const failed = harness(new Error('the design server exited with 1 before it was ready'));
  const result = await firstListingStep(['libs/cli/src/lib/design/a.ts'], failed.options);

  assert.equal(result.status, 1);
  assert.match(result.output, /exited with 1/);
  assert.equal(failed.loops[0].stopped, true);
});

test('the step is skipped without a design server change', async () => {
  const { loops, options } = harness({ ms: 29_000, listed: 6 });
  const result = await firstListingStep(['apps/ethlete-studio/src/a.ts'], options);

  assert.equal(result.status, 0);
  assert.equal(loops.length, 0);
});
