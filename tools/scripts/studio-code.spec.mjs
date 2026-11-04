import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cliCopyPlan } from './studio-code.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

test('a dirty libs/cli never takes the build, it keeps the copy the server runs', () => {
  assert.deepEqual(cliCopyPlan({ latest: B, dirty: true, copies: [A, C], current: A, distMatches: true }), {
    action: 'use',
    sha: A,
  });
});

test('a dirty libs/cli without any copy builds the committed state', () => {
  assert.deepEqual(cliCopyPlan({ latest: B, dirty: true, copies: [], current: null, distMatches: true }), {
    action: 'build',
    sha: B,
  });
});

test('a clean libs/cli takes the build when it matches the commit', () => {
  assert.deepEqual(cliCopyPlan({ latest: B, dirty: false, copies: [A], current: A, distMatches: true }), {
    action: 'copy',
    sha: B,
  });
});

test('a clean libs/cli whose build does not match builds the commit', () => {
  assert.deepEqual(cliCopyPlan({ latest: B, dirty: false, copies: [A], current: A, distMatches: false }), {
    action: 'build',
    sha: B,
  });
});

test('a copy of the commit is reused', () => {
  assert.deepEqual(cliCopyPlan({ latest: B, dirty: false, copies: [A, B], current: A, distMatches: true }), {
    action: 'use',
    sha: B,
  });
});

test("an agent's command runs the last commit even while libs/cli is dirty", () => {
  assert.deepEqual(
    cliCopyPlan({ latest: B, dirty: true, copies: [A], current: A, distMatches: true, keepWhenDirty: false }),
    { action: 'build', sha: B },
  );
  assert.deepEqual(
    cliCopyPlan({ latest: B, dirty: true, copies: [A, B], current: A, distMatches: true, keepWhenDirty: false }),
    { action: 'use', sha: B },
  );
});
