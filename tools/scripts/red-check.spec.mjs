import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./red-check.mjs', import.meta.url));

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const specFor = (expected) =>
  `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { value } from './value.mjs';\ntest('value is ${expected}', () => assert.equal(value, ${expected}));\n`;

const makeRepo = (parentValue, commitValue, specValue) => {
  const repo = mkdtempSync(join(tmpdir(), 'red-check-spec-'));
  mkdirSync(join(repo, 'lib'));
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 't@t.t');
  git(repo, 'config', 'user.name', 't');
  writeFileSync(join(repo, 'lib/value.mjs'), `export const value = ${parentValue};\n`);
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'base');
  writeFileSync(join(repo, 'lib/value.mjs'), `export const value = ${commitValue};\n`);
  writeFileSync(join(repo, 'lib/value.spec.mjs'), specFor(specValue));
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'change');
  return repo;
};

const run = (repo) => spawnSync('node', [script, 'HEAD'], { cwd: repo, encoding: 'utf8' });

test('a spec that fails at the parent state is red and named', () => {
  const repo = makeRepo(1, 2, 2);
  try {
    const result = run(repo);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /red: value is 2/);
    assert.equal(git(repo, 'worktree', 'list').split('\n').length, 1);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('a spec that already passes at the parent state is not red', () => {
  const repo = makeRepo(2, 3, 2);
  try {
    const result = run(repo);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /NOT RED/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
