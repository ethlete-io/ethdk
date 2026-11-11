import assert from 'node:assert/strict';
import { test } from 'node:test';
import { biteVerdict, parseBiteArgs } from './studio-e2e-bite.mjs';

test('takes the ref first and passes the rest to the e2e', () => {
  assert.deepEqual(parseBiteArgs(['abc123', '--case', 'Merge']), { ref: 'abc123', e2eArgs: ['--case', 'Merge'] });
});

test('rejects a missing ref', () => {
  assert.ok(parseBiteArgs([]).error);
  assert.ok(parseBiteArgs(['--case', 'Merge']).error);
});

test('a passing e2e on the old CLI does not bite', () => {
  assert.equal(biteVerdict(0).bites, false);
  assert.equal(biteVerdict(1).bites, true);
});

test('a refused e2e run (exit 2, e.g. a --case that matches no case) is no bite', () => {
  assert.equal(biteVerdict(2).bites, undefined);
  assert.equal(biteVerdict(2).refused, true);
});

test('--revert takes the fix sha and passes the rest to the e2e', () => {
  assert.deepEqual(parseBiteArgs(['--revert', 'abc123', '--case', 'Merge']), {
    revert: 'abc123',
    e2eArgs: ['--case', 'Merge'],
  });
});

test('--revert without a sha is refused', () => {
  assert.ok(parseBiteArgs(['--revert']).error);
  assert.ok(parseBiteArgs(['--revert', '--case', 'Merge']).error);
});
