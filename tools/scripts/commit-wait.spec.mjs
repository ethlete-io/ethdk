import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { waitForLock } from './commit-wait.mjs';

test('waits while the lock exists, reports it and never deletes it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'commit-wait-'));
  const lock = join(dir, 'index.lock');
  writeFileSync(lock, '');
  const logs = [];
  setTimeout(() => assert.ok(existsSync(lock)), 50);
  setTimeout(() => rmSync(lock), 200);
  const started = Date.now();
  await waitForLock(lock, { intervalMs: 20, reportMs: 60, log: (line) => logs.push(line) });
  assert.ok(Date.now() - started >= 150);
  assert.ok(logs.length >= 2);
  assert.match(logs[0], /^waiting for lock held since \d{4}-/);
  rmSync(dir, { recursive: true });
});

test('returns at once without a lock', async () => {
  const started = Date.now();
  await waitForLock(join(tmpdir(), 'commit-wait-none.lock'), { intervalMs: 1000 });
  assert.ok(Date.now() - started < 500);
});

test('commits the given paths and adds an untracked one without git add', () => {
  const repo = mkdtempSync(join(tmpdir(), 'commit-wait-repo-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args) => spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
  const script = join(resolve(dirname(fileURLToPath(import.meta.url))), 'commit-wait.mjs');

  try {
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 't'],
      ['config', 'user.email', 't@t.t'],
      ['config', 'commit.gpgsign', 'false'],
    ]) {
      assert.equal(git(...args).status, 0);
    }
    writeFileSync(join(repo, 'a.txt'), 'a\n');
    writeFileSync(join(repo, 'b.txt'), 'b\n');

    const result = spawnSync('node', [script, '-qm', 'one', '--', 'a.txt'], { cwd: repo, env, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(git('show', '--name-only', '--format=', 'HEAD').stdout.trim().split('\n'), ['a.txt']);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('passes more than ten paths to git as separate arguments', () => {
  const repo = mkdtempSync(join(tmpdir(), 'commit-wait-many-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args) => spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
  const script = join(resolve(dirname(fileURLToPath(import.meta.url))), 'commit-wait.mjs');
  const paths = Array.from({ length: 15 }, (_, index) => `dir with space/file-${index}.txt`);

  try {
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 't'],
      ['config', 'user.email', 't@t.t'],
      ['config', 'commit.gpgsign', 'false'],
    ]) {
      assert.equal(git(...args).status, 0);
    }
    mkdirSync(join(repo, 'dir with space'));
    for (const path of paths) writeFileSync(join(repo, path), `${path}\n`);
    writeFileSync(join(repo, 'other.txt'), 'other\n');

    const result = spawnSync('node', [script, '-qm', 'many', '--', ...paths], { cwd: repo, env, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(
      git('show', '--name-only', '--format=', 'HEAD').stdout.trim().split('\n').sort(),
      [...paths].sort(),
    );
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
