import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedPath, parseSlicePaths, pathsOutsideSlice, warningFor } from './check-slice-paths.mjs';

test('parses commas, whitespace, newlines and comment lines', () => {
  assert.deepEqual(parseSlicePaths('apps/a/, libs/b\n# note\nlibs/c/**/*.ts'), ['apps/a/', 'libs/b', 'libs/c/**/*.ts']);
  assert.deepEqual(parseSlicePaths(''), []);
});

test('a directory pattern allows the directory and what is under it, not a sibling prefix', () => {
  assert.equal(isAllowedPath('apps/ethlete-studio/src/a.ts', ['apps/ethlete-studio/']), true);
  assert.equal(isAllowedPath('apps/ethlete-studio-x/a.ts', ['apps/ethlete-studio']), false);
});

test('glob patterns match across and within segments', () => {
  assert.equal(isAllowedPath('libs/c/src/deep/a.ts', ['libs/c/**/*.ts']), true);
  assert.equal(isAllowedPath('libs/c/a.ts', ['libs/c/**/*.ts']), true);
  assert.equal(isAllowedPath('libs/c/a.css', ['libs/c/**/*.ts']), false);
  assert.equal(isAllowedPath('libs/c/x/a.ts', ['libs/c/*.ts']), false);
});

test('changesets and plans are always allowed', () => {
  assert.deepEqual(pathsOutsideSlice(['.changeset/a.md', 'plans/x.md', 'libs/components/a.ts'], ['apps/']), [
    'libs/components/a.ts',
  ]);
});

test('no declared slice paths means nothing is outside', () => {
  assert.deepEqual(pathsOutsideSlice(['libs/a.ts'], []), []);
});

test('the warning lists the outside paths and says it does not block', () => {
  const text = warningFor(['libs/a.ts'], ['apps/']);

  assert.match(text, /1 staged path is outside the slice \(apps\/\)/);
  assert.match(text, /libs\/a\.ts/);
  assert.match(text, /not blocked/);
  assert.equal(warningFor([], ['apps/']), '');
});
