import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { git, gitEnv, tempGitRepo } from './git-test-env.mjs';

test('git in a temp repo leaves the repo a hook points at untouched', () => {
  const hookRepo = tempGitRepo('git-env-hook-');
  const configPath = join(hookRepo, '.git', 'config');
  const before = readFileSync(configPath);
  const saved = { GIT_DIR: process.env.GIT_DIR, GIT_INDEX_FILE: process.env.GIT_INDEX_FILE };

  process.env.GIT_DIR = join(hookRepo, '.git');
  process.env.GIT_INDEX_FILE = join(hookRepo, '.git', 'index');

  try {
    const temp = tempGitRepo('git-env-temp-');
    git(temp, 'config', 'user.email', 'x@y');
    git(temp, 'config', 'user.name', 'x');
    git(temp, 'commit', '--allow-empty', '-qm', 'one');

    assert.equal(git(temp, 'log', '--format=%s'), 'one');
    assert.deepEqual(readFileSync(configPath), before);
    assert.equal(
      Object.keys(gitEnv()).some((key) => key.startsWith('GIT_')),
      false,
    );
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('gitEnv keeps GIT_* values set explicitly for the call', () => {
  assert.equal(gitEnv({ GIT_AUTHOR_NAME: 'A' }).GIT_AUTHOR_NAME, 'A');
});

test('an inherited GIT_DIR does reach unstripped git (the failure the helper prevents)', () => {
  const hookRepo = tempGitRepo('git-env-hook-');
  const temp = mkdtempSync(join(tmpdir(), 'git-env-raw-'));
  const out = execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd: temp,
    encoding: 'utf8',
    env: { ...process.env, GIT_DIR: join(hookRepo, '.git') },
  }).trim();

  assert.equal(out, join(hookRepo, '.git'));
});
