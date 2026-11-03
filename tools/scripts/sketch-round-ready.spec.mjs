import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sketchDirsOf, unreadyRoundsOf } from './sketch-round-ready.mjs';

const dir = '.ethlete/design/studio/sketches/components-button';

const sketch = (overrides = {}) =>
  JSON.stringify({
    target: 'components/button',
    status: 'in progress',
    rounds: [{ key: 'r1', title: '', note: 'what the round shows' }],
    variantInfo: { a: { authors: ['x'], round: 'r1' } },
    ...overrides,
  });

const check = (json, files = [`${dir}/a/button.ts`]) => unreadyRoundsOf(files, () => json);

test('finds the sketch dir of each staged sketch file once', () => {
  assert.deepEqual(sketchDirsOf([`${dir}/a/x.ts`, `${dir}/sketch.json`, 'libs/cli/x.ts']), [dir]);
});

test('refuses a drawn round that is in progress', () => {
  assert.equal(check(sketch()).length, 1);
  assert.match(check(sketch())[0], /^ROUND-NOT-READY components\/button: round r1 is drawn/);
});

test('passes a ready round, a held round, a round without a note and a sketch without variants', () => {
  assert.deepEqual(check(sketch({ status: 'ready' })), []);
  assert.deepEqual(check(sketch({ hold: { until: 'x' } })), []);
  assert.deepEqual(check(sketch({ rounds: [{ key: 'r1', title: '', note: '' }] })), []);
  assert.deepEqual(check(sketch({ variantInfo: {} })), []);
});

test('passes when the sketch dir has no sketch.json (discarded) or nothing staged touches a sketch', () => {
  assert.deepEqual(check(null), []);
  assert.deepEqual(check(sketch(), ['libs/cli/x.ts']), []);
});
