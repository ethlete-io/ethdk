import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { exportCommit, revertInExport, toolsStepEnv } from './commit-export.mjs';
import { git, tempGitRepo } from './git-test-env.mjs';

const commit = (repo, content, message, file = 'file.txt') => {
  writeFileSync(join(repo, file), content);
  git(repo, 'add', file);
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
};

test('exports a commit and applies the reverse of a named commit to it', (t) => {
  const repo = tempGitRepo('commit-export-spec-');
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  commit(repo, 'before\n', 'base');
  const fix = commit(repo, 'fixed\n', 'fix');
  const head = commit(repo, 'later\n', 'later', 'other.txt');
  writeFileSync(join(repo, 'file.txt'), 'dirty\n');

  const { dir, error } = exportCommit(repo, head, 'commit-export-spec');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.equal(error, undefined);
  assert.equal(readFileSync(join(dir, 'file.txt'), 'utf8'), 'fixed\n');

  assert.deepEqual(revertInExport(repo, fix, dir), {});
  assert.equal(readFileSync(join(dir, 'file.txt'), 'utf8'), 'before\n');
  assert.equal(readFileSync(join(dir, 'other.txt'), 'utf8'), 'later\n');
});

test('refuses a reverse diff that does not apply and leaves the export as it was', (t) => {
  const repo = tempGitRepo('commit-export-spec-');
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  commit(repo, 'before\n', 'base');
  const fix = commit(repo, 'fixed\n', 'fix');
  const head = commit(repo, 'rewritten\n', 'later');

  const { dir } = exportCommit(repo, head, 'commit-export-spec');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.match(revertInExport(repo, fix, dir).error, /does not apply/);
  assert.equal(readFileSync(join(dir, 'file.txt'), 'utf8'), 'rewritten\n');
});

test(
  'the tools step passes in a real HEAD export with the env the push suite gives it',
  { skip: process.env.ETHLETE_REPO_ROOT !== undefined },
  (t) => {
    const repo = join(import.meta.dirname, '..', '..');
    const { dir, error } = exportCommit(repo, git(repo, 'rev-parse', 'HEAD'), 'commit-export-spec');
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    assert.equal(error, undefined);

    const run = spawnSync('yarn', ['test:tools'], {
      cwd: dir,
      env: { ...process.env, ...toolsStepEnv(repo), NODE_TEST_CONTEXT: undefined },
      encoding: 'utf8',
    });

    assert.equal(
      run.status,
      0,
      run.stdout
        .split('\n')
        .filter((line) => line.startsWith('✖'))
        .join('\n'),
    );
  },
);
