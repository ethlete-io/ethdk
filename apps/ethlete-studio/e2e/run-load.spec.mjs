import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runLoadLineOf } from './run-load.mjs';

test('a run under the core count is a measurement', () => {
  assert.equal(runLoadLineOf({ start: 3.14, end: 7.9, cores: 8 }), 'load 3.1 at start, 7.9 at end on 8 cores');
});

test('a run above the core count at its start or its end is noisy', () => {
  assert.match(runLoadLineOf({ start: 39, end: 2, cores: 32 }), / - noisy, not a measurement$/);
  assert.match(runLoadLineOf({ start: 2, end: 51, cores: 32 }), / - noisy, not a measurement$/);
});
