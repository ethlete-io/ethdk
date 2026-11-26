import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { git as gitIn, gitEnv } from './git-test-env.mjs';
import { commandsFor } from './pre-push-checks.mjs';
import { tempDir } from './temp-dir.mjs';

const bad = '---\n"@ethlete/core": patch\n---\n\none. two.\n\nsecond paragraph\n';

test('an untracked bad changeset fails the working-tree run and never the committed one', () => {
  const repo = tempDir('lint-changesets-');
  const git = (...args) => gitIn(repo, ...args);
  mkdirSync(join(repo, 'tools/scripts'), { recursive: true });
  mkdirSync(join(repo, '.changeset'));
  copyFileSync(join(import.meta.dirname, 'lint-changesets.js'), join(repo, 'tools/scripts/lint-changesets.js'));
  writeFileSync(join(repo, '.changeset/good.md'), '---\n"@ethlete/core": patch\n---\n\nFix a thing.\n');
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  writeFileSync(join(repo, '.changeset/untracked.md'), bad);
  const run = (...args) =>
    spawnSync(process.execPath, [join(repo, 'tools/scripts/lint-changesets.js'), ...args], {
      cwd: repo,
      env: gitEnv(),
      encoding: 'utf8',
    });
  assert.equal(run().status, 1);
  assert.equal(run('--rev', 'HEAD').status, 0);
  writeFileSync(join(repo, '.changeset/committed.md'), bad);
  git('add', '.changeset/committed.md');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'bad');
  assert.equal(run('--rev', 'HEAD').status, 1);
  assert.equal(run('--rev', 'HEAD~1').status, 0);
});

test('the pre-push changeset check reads the pushed commit, not the working tree', () => {
  const [first] = commandsFor('lint:changesets', 'abc123');
  assert.deepEqual(first, ['node', ['tools/scripts/lint-changesets.js', '--rev', 'abc123']]);
});
