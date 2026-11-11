import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { commandsFor } from './pre-push-checks.mjs';

const bad = '---\n"@ethlete/core": patch\n---\n\none. two.\n\nsecond paragraph\n';

test('an untracked bad changeset fails the working-tree run and never the committed one', () => {
  const repo = mkdtempSync(join(tmpdir(), 'lint-changesets-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
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
      encoding: 'utf8',
    });
  assert.equal(run().status, 1);
  assert.equal(run('--rev', 'HEAD').status, 0);
  writeFileSync(join(repo, '.changeset/committed.md'), bad);
  git('add', '.changeset/committed.md');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'bad');
  assert.equal(run('--rev', 'HEAD').status, 1);
  assert.equal(run('--rev', 'HEAD~1').status, 0);
  rmSync(repo, { recursive: true, force: true });
});

test('the pre-push changeset check reads the pushed commit, not the working tree', () => {
  const [first] = commandsFor('lint:changesets', 'abc123');
  assert.deepEqual(first, ['node', ['tools/scripts/lint-changesets.js', '--rev', 'abc123']]);
  assert.deepEqual(commandsFor('lint:size', 'abc123'), [['yarn', ['lint:size']]]);
});
