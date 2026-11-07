import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noVerifyFindings } from './check-no-verify-briefs.mjs';

test('flags an instruction to commit with --no-verify', () => {
  assert.deepEqual(noVerifyFindings('a\nrun the commit with --no-verify -m x'), [
    { line: 2, text: 'run the commit with --no-verify -m x' },
  ]);
});

test('allows a line that forbids it', () => {
  assert.deepEqual(noVerifyFindings('Never use --no-verify.'), []);
});

test('ignores text without it', () => {
  assert.deepEqual(noVerifyFindings('commit with -m x'), []);
});
