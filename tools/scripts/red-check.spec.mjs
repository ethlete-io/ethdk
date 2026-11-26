import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readVitestReport, verdictOf } from './red-check.mjs';
import { gitExec } from './git-test-env.mjs';

const script = fileURLToPath(new URL('./red-check.mjs', import.meta.url));

const git = (cwd, ...args) => gitExec(args, { cwd, encoding: 'utf8' }).trim();

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

test('a module the commit adds with only a default export is stubbed, so the assertions are red', () => {
  const repo = makeCommit(
    { 'keep.txt': 'x\n' },
    {
      'rule.mjs': "export default function rule() {\n  return ['x'];\n}\n",
      'rule.spec.mjs': specOf("import rule from './rule.mjs';", "assert.deepEqual(rule(), ['x']);"),
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

const vitestReport = JSON.parse(readFileSync(new URL('./red-check.vitest-report.json', import.meta.url), 'utf8'));
const onlySpec = (name) => {
  const read = readVitestReport({ testResults: vitestReport.testResults.filter((f) => f.name.endsWith(name)) });
  return { ...read, ...verdictOf(read.failures, read.crashes) };
};

test('a vitest spec that only crashes is red by crash, not proof', () => {
  const result = onlySpec('/crash.spec.ts');
  assert.deepEqual(result.crashes['/fixture/crash.spec.ts'], ['crashes on a missing function']);
  assert.equal(result.ok, false);
  assert.match(result.reason, /^RED BY CRASH/);
});

test('a vitest spec with a crash and an assertion failure stays red', () => {
  const result = onlySpec('/mixed.spec.ts');
  assert.deepEqual(result.failures['/fixture/mixed.spec.ts'], [
    'crashes on a missing function',
    'fails on an assertion',
  ]);
  assert.deepEqual(result.crashes['/fixture/mixed.spec.ts'], ['crashes on a missing function']);
  assert.equal(result.ok, true);
});

test('a range reads red where the single sha of its last commit does not', () => {
  const repo = makeRepo(1, 2, 2);
  try {
    const base = git(repo, 'rev-parse', 'HEAD~1');
    git(repo, 'reset', '-q', '--hard', base);
    writeFileSync(join(repo, 'lib/value.mjs'), 'export const value = 2;\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'fix');
    writeFileSync(join(repo, 'lib/value.spec.mjs'), specFor(2));
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'spec');
    const single = spawnSync('node', [script, 'HEAD'], { cwd: repo, encoding: 'utf8' });
    assert.equal(single.status, 1, single.stdout + single.stderr);
    assert.match(single.stdout, /NOT RED/);
    const range = spawnSync('node', [script, `${base}..HEAD`], { cwd: repo, encoding: 'utf8' });
    assert.equal(range.status, 0, range.stdout + range.stderr);
    assert.match(range.stdout, /red: value is 2/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
