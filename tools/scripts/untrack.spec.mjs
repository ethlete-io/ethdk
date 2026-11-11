import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { git, gitEnv, tempGitRepo } from './git-test-env.mjs';

const script = join(import.meta.dirname, 'untrack.mjs');

const repoWith = (files) => {
  const dir = tempGitRepo('untrack-spec-');
  git(dir, 'config', 'user.email', 'x@y');
  git(dir, 'config', 'user.name', 'x');
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  git(dir, 'add', '--', ...Object.keys(files));
  git(dir, 'commit', '-qm', 'base');
  return dir;
};

const untrack = (dir, ...args) =>
  spawnSync(process.execPath, [script, ...args], { cwd: dir, env: gitEnv(), encoding: 'utf8' });

test('untrack commits the removal and keeps the file byte-identical', () => {
  const dir = repoWith({ 'x.json': '{"a":1}\n', 'keep.txt': 'keep\n' });
  writeFileSync(join(dir, 'keep.txt'), 'edited\n');

  const result = untrack(dir, '-m', 'drop x', 'x.json');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(dir, 'ls-files', 'x.json'), '');
  assert.equal(readFileSync(join(dir, 'x.json'), 'utf8'), '{"a":1}\n');
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'drop x');
  assert.equal(git(dir, 'show', '--name-status', '--format=', 'HEAD'), 'D\tx.json');
  assert.equal(git(dir, 'status', '--porcelain', '--', 'keep.txt'), 'M keep.txt');
});

test('untrack refuses a path that git does not track', () => {
  const dir = repoWith({ 'x.json': '{}\n' });
  writeFileSync(join(dir, 'loose.txt'), 'loose\n');

  const result = untrack(dir, '-m', 'drop', 'loose.txt');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /loose\.txt is not tracked/);
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'base');
});

test('untrack puts the file back when the commit fails', () => {
  const dir = repoWith({ 'x.json': '{}\n' });
  writeFileSync(join(dir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });

  const result = untrack(dir, '-m', 'drop', 'x.json');

  assert.equal(result.status, 1);
  assert.equal(readFileSync(join(dir, 'x.json'), 'utf8'), '{}\n');
  assert.equal(git(dir, 'ls-files', 'x.json'), 'x.json');
});

test('untrack refuses a call without a message', () => {
  const dir = repoWith({ 'x.json': '{}\n' });

  const result = untrack(dir, 'x.json');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /-m "<commit message>" is missing/);
});
