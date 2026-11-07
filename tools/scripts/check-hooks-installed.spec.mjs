import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { hooksProblemOf } from './check-hooks-installed.mjs';
import { useAbsoluteHooksPath } from './postinstall.mjs';

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

const worktreeOf = (repo) => {
  spawnSync('git', ['-c', 'user.email=a@b.c', '-c', 'user.name=t', 'commit', '--allow-empty', '-m', 'x', '--quiet'], {
    cwd: repo,
  });
  const worktree = join(repo, '.claude', 'worktrees', 'wt');
  spawnSync('git', ['worktree', 'add', '--quiet', '-b', 'wt', worktree], { cwd: repo });

  return realpathSync(worktree);
};

test('in a worktree a relative husky path fails and an absolute one passes', () => {
  const repo = repoOf();
  installHooks(repo);
  const worktree = worktreeOf(repo);
  setHooksPath(repo, '.husky/_');
  assert.match(hooksProblemOf(worktree), /not installed/);
  setHooksPath(repo, join(repo, '.husky', '_'));
  assert.equal(hooksProblemOf(worktree), null);
});

test('postinstall sets the absolute path of the main checkout from a worktree', () => {
  const repo = repoOf();
  installHooks(repo);
  const worktree = worktreeOf(repo);
  setHooksPath(repo, '.husky/_');
  assert.equal(useAbsoluteHooksPath(worktree), join(repo, '.husky', '_'));
  assert.equal(hooksProblemOf(worktree), null);
});

test('postinstall leaves core.hooksPath alone without a worktrees directory', () => {
  const repo = repoOf();
  setHooksPath(repo, '.husky/_');
  assert.equal(useAbsoluteHooksPath(repo), null);
});
