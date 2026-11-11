import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { hooksProblemOf } from './check-hooks-installed.mjs';
import { useTrackedHooksPath } from './postinstall.mjs';
import { gitSpawn } from './git-test-env.mjs';

const created = [];

after(() => created.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const repoOf = () => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'hooks-installed-')));
  created.push(repo);
  gitSpawn(['init', '--quiet'], { cwd: repo });

  return repo;
};

const addHooks = (repo) => {
  mkdirSync(join(repo, '.husky'), { recursive: true });
  writeFileSync(join(repo, '.husky', 'pre-commit'), '');
};

const setHooksPath = (repo, value) => gitSpawn(['config', 'core.hooksPath', value], { cwd: repo });

test('fails when core.hooksPath is unset', () => {
  assert.match(hooksProblemOf(repoOf()), /core\.hooksPath is unset/);
});

test('fails when hooksPath is set but the hooks are missing', () => {
  const repo = repoOf();
  setHooksPath(repo, '.husky');
  assert.match(hooksProblemOf(repo), /not installed/);
});

test('fails when hooksPath points somewhere else', () => {
  const repo = repoOf();
  addHooks(repo);
  setHooksPath(repo, '.githooks');
  assert.match(hooksProblemOf(repo), /not installed/);
});

test('passes with the relative .husky path and a pre-commit', () => {
  const repo = repoOf();
  addHooks(repo);
  setHooksPath(repo, '.husky');
  assert.equal(hooksProblemOf(repo), null);
});

test('passes outside a git repository', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'hooks-installed-')));
  created.push(dir);
  assert.equal(hooksProblemOf(dir), null);
});

const worktreeOf = (repo) => {
  gitSpawn(['-c', 'user.email=a@b.c', '-c', 'user.name=t', 'commit', '--allow-empty', '-m', 'x', '--quiet'], {
    cwd: repo,
  });
  const worktree = join(repo, '.claude', 'worktrees', 'wt');
  gitSpawn(['worktree', 'add', '--quiet', '-b', 'wt', worktree], { cwd: repo });

  return realpathSync(worktree);
};

test('an absolute path to the main checkout fails in a worktree', () => {
  const repo = repoOf();
  addHooks(repo);
  const worktree = worktreeOf(repo);
  setHooksPath(repo, join(repo, '.husky'));
  assert.match(hooksProblemOf(worktree), /not installed/);
});

test('postinstall sets the relative path and a worktree runs its own hooks', () => {
  const repo = repoOf();
  addHooks(repo);
  gitSpawn(['add', '.'], { cwd: repo });
  const worktree = worktreeOf(repo);
  assert.equal(useTrackedHooksPath(repo), '.husky');
  assert.equal(gitSpawn(['config', 'core.hooksPath'], { cwd: worktree, encoding: 'utf8' }).stdout.trim(), '.husky');
  assert.equal(hooksProblemOf(repo), null);
});

test('postinstall does nothing outside a git repository', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'hooks-installed-')));
  created.push(dir);
  assert.equal(useTrackedHooksPath(dir), null);
});
