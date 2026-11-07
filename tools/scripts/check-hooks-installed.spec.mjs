import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { hooksProblemOf } from './check-hooks-installed.mjs';

const created = [];

after(() => created.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const repoOf = () => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'hooks-installed-')));
  created.push(repo);
  spawnSync('git', ['init', '--quiet'], { cwd: repo });

  return repo;
};

const installHooks = (repo) => {
  mkdirSync(join(repo, '.husky', '_'), { recursive: true });
  writeFileSync(join(repo, '.husky', '_', 'pre-commit'), '');
};

const setHooksPath = (repo, value) => spawnSync('git', ['config', 'core.hooksPath', value], { cwd: repo });

test('fails when core.hooksPath is unset', () => {
  assert.match(hooksProblemOf(repoOf()), /core\.hooksPath is unset/);
});

test('fails when hooksPath is set but .husky/_ was never generated', () => {
  const repo = repoOf();
  setHooksPath(repo, '.husky/_');
  assert.match(hooksProblemOf(repo), /not installed/);
});

test('fails when hooksPath points somewhere else', () => {
  const repo = repoOf();
  installHooks(repo);
  setHooksPath(repo, '.githooks');
  assert.match(hooksProblemOf(repo), /not installed/);
});

test('passes with the relative husky path and a generated pre-commit', () => {
  const repo = repoOf();
  installHooks(repo);
  setHooksPath(repo, '.husky/_');
  assert.equal(hooksProblemOf(repo), null);
});

test('passes with an absolute husky path', () => {
  const repo = repoOf();
  installHooks(repo);
  setHooksPath(repo, join(repo, '.husky', '_'));
  assert.equal(hooksProblemOf(repo), null);
});

test('passes outside a git repository', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'hooks-installed-')));
  created.push(dir);
  assert.equal(hooksProblemOf(dir), null);
});
