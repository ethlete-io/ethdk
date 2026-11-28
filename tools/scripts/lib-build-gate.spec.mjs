import assert from 'node:assert/strict';
import { test } from 'node:test';
import { limitTo } from './lib-build-gate.mjs';

test('the SDK gate leaves out a changed lib of another CI group', () => {
  assert.deepEqual(limitTo(['core', 'timetrack'], 'core,components'), ['core']);
});

test('without a project list every changed lib is built', () => {
  assert.deepEqual(limitTo(['core', 'timetrack'], undefined), ['core', 'timetrack']);
});
