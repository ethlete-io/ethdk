import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { commitPatch } from './commit-patch.mjs';
import { git, gitEnv, tempGitRepo } from './git-test-env.mjs';
import { tempDir } from './temp-dir.mjs';

const lines = (changed = []) =>
  Array.from({ length: 30 }, (_, i) => (changed.includes(i + 1) ? `changed ${i + 1}` : `line ${i + 1}`)).join('\n') +
  '\n';

const setup = () => {
  const dir = tempGitRepo('commit-patch-');
  git(dir, 'config', 'user.email', 'a@b.c');
  git(dir, 'config', 'user.name', 'a');
  git(dir, 'config', 'commit.gpgsign', 'false');
  const file = join(dir, 'f.txt');
  writeFileSync(file, lines());
  writeFileSync(join(dir, 'other.txt'), 'other\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  writeFileSync(file, lines([2, 29]));
  writeFileSync(join(dir, 'other.txt'), 'other staged\n');
  git(dir, 'add', 'other.txt');
  const [header, ...hunks] = git(dir, 'diff', '-U0', '--', 'f.txt').split('\n@@');
  const hunk1 = `${header}\n@@${hunks[0]}\n`;
  const patch = join(tempDir('commit-patch-file-'), 'hunk.patch');
  writeFileSync(patch, hunk1);
  return { dir, file, patch };
};

const naive = (patch, message, dir) => {
  git(dir, 'commit', '-q', '-m', message, '--', 'f.txt');
  return 0;
};
const commit = process.env.COMMIT_PATCH_NAIVE ? naive : commitPatch;

test('commits only the patch hunk and leaves index and tree alone', () => {
  const { dir, file, patch } = setup();
  const indexBefore = git(dir, 'diff', '--cached', '--name-only');

  assert.equal(commit(patch, 'feat(repo): One hunk', dir, gitEnv()), 0);

  const head = git(dir, 'show', 'HEAD:f.txt');
  assert.match(head, /changed 2\n/);
  assert.doesNotMatch(head, /changed 29/);
  assert.match(readFileSync(file, 'utf8'), /changed 2\n[\s\S]*changed 29/);
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), indexBefore);
  assert.equal(git(dir, 'diff', '--cached', '--name-only', '--', 'f.txt'), '');
  assert.match(git(dir, 'diff', '--', 'f.txt'), /changed 29/);
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'feat(repo): One hunk');
});
