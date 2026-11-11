import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { git, gitEnv, tempGitRepo } from './git-test-env.mjs';
import {
  describeSource,
  formatSlicePathsFile,
  isAllowedPath,
  parseSlicePaths,
  pathsChangedByMerge,
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

const SCRIPT = fileURLToPath(new URL('./check-slice-paths.mjs', import.meta.url));

const write = (dir, path, content) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
};

const commitAll = (dir, message) => {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--no-verify', '-m', message);
};

const mergeRepo = () => {
  const dir = tempGitRepo('slice-merge-');
  git(dir, 'checkout', '-q', '-b', 'main');
  write(dir, 'tools/own.mjs', 'a\n');
  write(dir, 'libs/x/a.ts', 'a\n');
  write(dir, 'libs/x/both.ts', 'top\nmid\nend\n');
  commitAll(dir, 'base');
  git(dir, 'checkout', '-q', '-b', 'incoming');
  write(dir, 'libs/x/a.ts', 'incoming\n');
  write(dir, 'libs/x/new.ts', 'new\n');
  write(dir, 'libs/x/both.ts', 'incoming\nmid\nend\n');
  commitAll(dir, 'incoming');
  git(dir, 'checkout', '-q', 'main');
  write(dir, 'tools/own.mjs', 'mine\n');
  write(dir, 'libs/x/both.ts', 'top\nmid\nmine\n');
  commitAll(dir, 'mine');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'merge', '-q', '--no-commit', '--no-ff', 'incoming');
  writeFileSync(join(dir, git(dir, 'rev-parse', '--git-path', 'slice-paths')), 'tools/\n');

  return dir;
};

const runNode = (dir) => {
  const env = gitEnv();
  delete env.ETHLETE_SLICE_PATHS;

  return spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8', env });
};

test('in a merge, paths taken unchanged from MERGE_HEAD or a clean auto-merge stay silent', () => {
  const dir = mergeRepo();
  const result = runNode(dir);

  assert.equal(result.stderr, '');
});

test('in a merge, an own out-of-slice edit still warns', () => {
  const dir = mergeRepo();
  write(dir, 'libs/x/a.ts', 'incoming plus mine\n');
  git(dir, 'add', 'libs/x/a.ts');
  const result = runNode(dir);

  assert.match(result.stderr, /1 staged path is outside the slice/);
  assert.match(result.stderr, /libs\/x\/a\.ts/);
  assert.doesNotMatch(result.stderr, /new\.ts/);
});

test('pathsChangedByMerge keeps only paths that differ from both sides', () => {
  const blobs = {
    ':a': '1',
    'HEAD:a': '0',
    'MERGE_HEAD:a': '1',
    ':b': '2',
    'HEAD:b': '0',
    'MERGE_HEAD:b': '1',
    'HEAD:c': '0',
    'HEAD:d': '0',
    'MERGE_HEAD:d': '0',
  };
  const blob = (rev, path) => blobs[`${rev}:${path}`] ?? null;

  assert.deepEqual(pathsChangedByMerge(['a', 'b', 'c', 'd'], blob, ['HEAD', 'MERGE_HEAD']), ['b', 'd']);
  assert.deepEqual(
    pathsChangedByMerge(['b'], (rev, path) => (rev === 'T' ? '2' : blob(rev, path)), ['HEAD', 'MERGE_HEAD', 'T']),
    [],
  );
});
