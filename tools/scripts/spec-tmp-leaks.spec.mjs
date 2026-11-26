import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { newEntries, reportLines } from './spec-tmp-leaks.mjs';

test('newEntries returns only the names added since the first listing', () => {
  assert.deepEqual(newEntries(['a', 'b'], ['b', 'z-1', 'a', 'c-2']), ['c-2', 'z-1']);
  assert.deepEqual(newEntries(['a', 'b'], ['a']), []);
});

test('reportLines names each leaking spec and caps the listed entries', () => {
  const lines = reportLines(
    [
      { spec: 'clean.spec.mjs', leaked: [] },
      { spec: 'leaky.spec.mjs', leaked: ['x-1', 'x-2', 'x-3'] },
    ],
    2,
  );
  assert.deepEqual(lines, [`leaky.spec.mjs: 3 new ${tmpdir()} entries (x-1, x-2, +1 more)`]);
});
