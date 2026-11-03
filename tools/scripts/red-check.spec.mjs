import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

const makeCommit = (base, change) => {
  const repo = mkdtempSync(join(tmpdir(), 'red-check-spec-'));
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 't@t.t');
  git(repo, 'config', 'user.name', 't');
  const write = (files) => {
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, name)), { recursive: true });
      writeFileSync(join(repo, name), text);
    }
  };
  write(base);
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'base');
  write(change);
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'change');
  return repo;
};

const specOf = (importLine, body) =>
  `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\n${importLine}\ntest('rule', () => { ${body} });\n`;

test('a spec that only fails to load is load-only, not red', () => {
  const repo = makeCommit(
    { 'value.mjs': 'export const a = 1;\n' },
    {
      'value.mjs': 'export const a = 1;\nexport const b = 2;\n',
      'value.spec.mjs': specOf("import { b } from './value.mjs';", 'assert.equal(b, 2);'),
    },
  );
  try {
    const result = run(repo);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /LOAD-ONLY/);
    assert.doesNotMatch(result.stdout, /red: /);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('a module the commit adds is stubbed, so the assertions are red', () => {
  const repo = makeCommit(
    { 'keep.txt': 'x\n' },
    {
      'rule.mjs': "export function rule() {\n  return ['x'];\n}\n",
      'rule.spec.mjs': specOf("import { rule } from './rule.mjs';", "assert.deepEqual(rule(), ['x']);"),
    },
  );
  try {
    const result = run(repo);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /red: rule/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('a module the commit adds in a new folder is stubbed there', () => {
  const repo = makeCommit(
    { 'keep.txt': 'x\n' },
    {
      'fresh/rule.mjs': "export function rule() {\n  return ['x'];\n}\n",
      'fresh/rule.spec.mjs': specOf("import { rule } from './rule.mjs';", "assert.deepEqual(rule(), ['x']);"),
    },
  );
  try {
    const result = run(repo);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /red: rule/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('an added module the auto stub cannot satisfy is reported', () => {
  const repo = makeCommit(
    { 'keep.txt': 'x\n' },
    {
      'rule.mjs': 'export default function rule() {}\n',
      'rule.spec.mjs': specOf("import { missing } from './rule.mjs';", 'assert.equal(missing, 1);'),
    },
  );
  try {
    const result = run(repo);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /auto stub failed, hand stub needed/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('a spec that only throws a TypeError at the parent state is red by crash, not proof', () => {
  const repo = makeCommit(
    { 'value.mjs': 'export const value = 1;\n', 'value.spec.mjs': specOf(`import { value } from './value.mjs';`, '') },
    {
      'value.mjs': 'export const value = 1;\nexport const twice = (n) => n * 2;\n',
      'value.spec.mjs': specOf(`import * as m from './value.mjs';`, 'assert.equal(m.twice(2), 4);'),
    },
  );
  try {
    const result = run(repo);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /red by crash: rule/);
    assert.match(result.stdout, /NOT RED: RED BY CRASH/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
