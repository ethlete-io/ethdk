import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeSource,
  formatSlicePathsFile,
  isAllowedPath,
  parseSlicePaths,
  pathsOutsideSlice,
  warningFor,
} from './check-slice-paths.mjs';

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

const NOW = Date.parse('2026-11-10T12:00:00.000Z');
const HOUR = 3600000;
const header = (name, at) => `# slice: ${name}\n# written: ${new Date(at).toISOString()}\napps/a/\n`;

test('an env source is named and never stale', () => {
  assert.deepEqual(describeSource({ env: true }, NOW), { text: 'env ETHLETE_SLICE_PATHS', stale: false });
});

test('a fresh file names its path, slice and age', () => {
  const source = describeSource(
    { file: { path: '.git/slice-paths', content: header('b1', NOW - 20 * 60000), mtimeMs: 0 } },
    NOW,
  );

  assert.deepEqual(source, { text: 'file .git/slice-paths, slice "b1", written 20 min ago', stale: false });
});

test('a file older than 2 h is stale', () => {
  const source = describeSource(
    { file: { path: '.git/slice-paths', content: header('old', NOW - 3 * HOUR), mtimeMs: NOW } },
    NOW,
  );

  assert.equal(source.stale, true);
  assert.match(source.text, /slice "old", written 3 h ago - stale$/);
});

test('a file with no header falls back to its mtime', () => {
  const content = 'apps/a/\n';

  assert.deepEqual(describeSource({ file: { path: 'p', content, mtimeMs: NOW - 10 * 60000 } }, NOW), {
    text: 'file p, written 10 min ago',
    stale: false,
  });
  assert.equal(describeSource({ file: { path: 'p', content, mtimeMs: NOW - 5 * HOUR } }, NOW).stale, true);
});

test('a stale warning leads with the stale note and the --set command', () => {
  const source = describeSource({ file: { path: 'p', content: header('old', NOW - 3 * HOUR), mtimeMs: 0 } }, NOW);
  const text = warningFor(['libs/a.ts'], ['apps/'], source);

  assert.match(text, /^The slice-paths file is stale.*--set "<slice name>"/);
  assert.match(text, /slice paths from file p, slice "old"/);
  assert.match(
    warningFor(['libs/a.ts'], ['apps/'], { text: 'env ETHLETE_SLICE_PATHS', stale: false }),
    /^slice paths from env/,
  );
});

test('the written file round-trips through parseSlicePaths and carries its header', () => {
  const text = formatSlicePathsFile('b1', ['apps/a/', 'libs/b'], NOW);

  assert.match(text, /^# slice: b1\n# written: 2026-11-10T12:00:00\.000Z\n/);
  assert.deepEqual(parseSlicePaths(text), ['apps/a/', 'libs/b']);
});
