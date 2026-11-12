import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { tempDir } from './temp-dir.mjs';
import { fileURLToPath } from 'node:url';
import { commitMessageProblems, workflowCommitMessages } from './check-workflow-commit-messages.mjs';

const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const problemsFor = (message) => {
  const root = tempDir('wf-');
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(root, '.github', 'workflows', 'a.yml'), `with:\n  commit_message: '${message}'\n`);
  return commitMessageProblems(root, (_root, text) => {
    const { spawnSync } = process.getBuiltinModule('node:child_process');
    const result = spawnSync('yarn', ['commitlint'], { cwd: repoRoot, input: text, encoding: 'utf8' });
    return result.status === 0 ? null : `${result.stdout}${result.stderr}`.trim();
  });
};

test('reads quoted commit_message values with their line', () => {
  assert.deepEqual(workflowCommitMessages("a:\n  commit_message: 'chore: x'\n"), [{ line: 2, message: 'chore: x' }]);
});

test('flags the old scopeless bot message', () => {
  const problems = problemsFor('chore: 🤖 update prereleases');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /scope/);
});

test('passes the scoped bot messages', () => {
  assert.deepEqual(problemsFor('chore(repo): Update prereleases'), []);
  assert.deepEqual(problemsFor('chore(repo): Update versions'), []);
});

test('every workflow commit_message in the repo passes', () => {
  assert.deepEqual(commitMessageProblems(repoRoot), []);
});
