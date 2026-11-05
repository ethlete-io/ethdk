import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { libsWithChangedDependencies } from './lib-build-gate.mjs';
import {
  blockingTypeErrors,
  filesExpectingSpecs,
  isDocsOnly,
  ranNoSpecs,
  suitesForFiles,
  timedOutSpecs,
  toolFilesToLint,
} from './precommit-specs.mjs';

const sdk = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
const repos = [];

after(() => repos.forEach((repo) => rmSync(repo, { recursive: true, force: true })));

const write = (repo, file, text) => {
  mkdirSync(dirname(join(repo, file)), { recursive: true });
  writeFileSync(join(repo, file), text);
};

const sh = (repo, command, args) => spawnSync(command, args, { cwd: repo, env, encoding: 'utf8' });

const repoWithValueSpec = () => {
  const repo = mkdtempSync(join(tmpdir(), 'precommit-spec-'));
  repos.push(repo);

  for (const file of [
    '.husky/pre-commit',
    'tools/scripts/precommit-specs.mjs',
    'tools/scripts/link-node-modules.mjs',
    'tools/scripts/cli-related-map.mjs',
    'tools/scripts/lint-css-properties.js',
    'tools/scripts/sketch-round-ready.mjs',
  ]) {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    copyFileSync(join(sdk, file), join(repo, file));
  }
  symlinkSync(join(sdk, 'node_modules'), join(repo, 'node_modules'));
  write(repo, '.gitignore', 'node_modules\n');
  write(
    repo,
    'libs/cli/vitest.config.mts',
    "import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({ test: { include: ['src/**/*.spec.ts'] } });\n",
  );
  write(repo, 'libs/cli/src/value.ts', 'export const value = 1;\n');
  write(
    repo,
    'libs/cli/src/value.spec.ts',
    "import { expect, test } from 'vitest';\nimport { value } from './value';\n\ntest('value', () => expect(value).toBe(1));\n",
  );

  for (const args of [
    ['init', '-q'],
    ['add', '.'],
    ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base'],
  ]) {
    assert.equal(sh(repo, 'git', args).status, 0);
  }
  return repo;
};

const stageThenEdit = (repo, staged, unstaged) => {
  write(repo, 'libs/cli/src/value.ts', staged);
  assert.equal(sh(repo, 'git', ['add', 'libs/cli/src/value.ts']).status, 0);
  write(repo, 'libs/cli/src/value.ts', unstaged);
  return sh(repo, 'sh', ['.husky/pre-commit']);
};

test('passes a staged fix although the working tree holds a broken edit', () => {
  const hook = stageThenEdit(repoWithValueSpec(), 'export const value = 2 - 1;\n', 'export const value = 3;\n');
  assert.equal(hook.status, 0, hook.stdout + hook.stderr);
});

test('fails a staged break although the working tree holds a fix', () => {
  const hook = stageThenEdit(repoWithValueSpec(), 'export const value = 3;\n', 'export const value = 1;\n');
  assert.notEqual(hook.status, 0, hook.stdout + hook.stderr);
  assert.match(hook.stderr, /a cli spec related to the staged files fails/);
});

test('maps staged files to the Studio and cli suites', () => {
  const suites = suitesForFiles(
    ['apps/ethlete-studio/a.ts', 'libs/x/r.ts', 'tools/scripts/t.mjs', 'README.md'],
    { 'src/m.spec.ts': ['libs/x/*.ts'] },
    ['tools/scripts/*.spec.mjs', 'tools/other/*.spec.mjs'],
  );
  assert.deepEqual(
    suites.map((suite) => [suite.name, suite.files]),
    [
      ['Studio', ['apps/ethlete-studio/a.ts']],
      ['cli', ['libs/cli/src/m.spec.ts']],
      ['tools/scripts', ['tools/scripts/t.mjs']],
    ],
  );
  assert.deepEqual(suitesForFiles(['README.md'], {}), []);
});

test('runs the declared source-wide specs for a new unrelated cli source', () => {
  const repo = repoWithValueSpec();
  write(
    repo,
    'libs/cli/src/wide.spec.ts',
    "import { readdirSync, readFileSync } from 'node:fs';\nimport { join } from 'node:path';\nimport { expect, test } from 'vitest';\n\ntest('no source says BROKEN', () => {\n  const bad = readdirSync(__dirname).filter((file) => readFileSync(join(__dirname, file), 'utf8').includes('BROKEN'));\n  expect(bad).toEqual([]);\n});\n",
  );
  write(repo, 'libs/cli/related-map.json', '{ "sourceWide": ["src/wide.spec.ts"] }\n');
  assert.equal(sh(repo, 'git', ['add', '.']).status, 0);
  assert.equal(sh(repo, 'git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'wide']).status, 0);

  write(repo, 'libs/cli/src/other.ts', "export const other = 'BROKEN';\n");
  assert.equal(sh(repo, 'git', ['add', 'libs/cli/src/other.ts']).status, 0);
  const hook = sh(repo, 'sh', ['.husky/pre-commit']);
  assert.notEqual(hook.status, 0, hook.stdout + hook.stderr);
});

test('adds the source-wide specs for any staged cli source', () => {
  const map = { sourceWide: ['src/w.spec.ts'], 'src/m.spec.ts': ['libs/x/*.ts'] };
  assert.deepEqual(suitesForFiles(['libs/cli/src/new.ts'], map)[0].files, [
    'libs/cli/src/new.ts',
    'libs/cli/src/w.spec.ts',
  ]);
  assert.deepEqual(suitesForFiles(['libs/cli/package.json'], map)[0].files, ['libs/cli/package.json']);
});

test('selects the update specs that read a staged migrations.json or generators.json', () => {
  const map = JSON.parse(readFileSync('libs/cli/related-map.json', 'utf8'));
  const files = (file) => suitesForFiles([file], map)[0]?.files ?? [];

  assert.ok(files('libs/query/migrations.json').includes('libs/cli/src/lib/update/query-migrations.spec.ts'));
  assert.ok(
    files('libs/query/generators/generators.json').includes('libs/cli/src/lib/update/query-migrations.spec.ts'),
  );
  assert.ok(files('libs/core/migrations.json').includes('libs/cli/src/lib/update/generator-requirements.spec.ts'));
});

test('treats plans, docs, markdown and changesets as docs-only', () => {
  assert.equal(isDocsOnly(['plans/a/b.md', 'apps/docs/cli/index.md', '.changeset/x.md', 'README.md']), true);
  assert.equal(isDocsOnly(['plans/a/b.md', 'libs/cli/src/a.ts']), false);
});

test('finds the specs that failed only by timeout', () => {
  const timeout = ' FAIL  src/a.spec.ts > x\nError: Test timed out in 5000ms.\n';
  assert.deepEqual(timedOutSpecs(timeout), ['src/a.spec.ts']);
  assert.deepEqual(timedOutSpecs(`${timeout} FAIL  src/b.spec.ts > y\nAssertionError: expected 1 to be 2\n`), []);
  assert.deepEqual(timedOutSpecs(''), []);
});

test('finds a timed-out spec behind the vitest project name', () => {
  const timeout = ' FAIL  |cli| src/a.spec.ts > x\nError: Test timed out in 300ms.\n';
  assert.deepEqual(timedOutSpecs(timeout), ['src/a.spec.ts']);
});

test('finds a timed-out spec in colored vitest output', () => {
  const timeout =
    '\x1b[41m\x1b[1m FAIL \x1b[22m\x1b[49m src/a.spec.ts\x1b[2m > \x1b[22mx\n\x1b[31m\x1b[1mError\x1b[22m: Test timed out in 300ms.\n';
  assert.deepEqual(timedOutSpecs(timeout), ['src/a.spec.ts']);
});

test('a docs-only staged commit starts no vitest', () => {
  const repo = repoWithValueSpec();
  write(repo, 'plans/p.md', 'x\n');
  assert.equal(sh(repo, 'git', ['add', 'plans/p.md']).status, 0);
  const started = Date.now();
  const hook = sh(repo, 'sh', ['.husky/pre-commit']);
  assert.equal(hook.status, 0, hook.stdout + hook.stderr);
  assert.doesNotMatch(hook.stdout + hook.stderr, /vitest|RUN/i);
  assert.ok(Date.now() - started < 3000);
});

test('blockingTypeErrors blocks on every tsc error, in spec files the commit does not touch too', () => {
  const output = ['libs/cli/src/a.spec.ts(1,1): error TS2532: Object is possibly undefined.', 'Found 1 error.'].join(
    '\n',
  );

  assert.deepEqual(blockingTypeErrors(output), [
    'libs/cli/src/a.spec.ts(1,1): error TS2532: Object is possibly undefined.',
  ]);
});

test('recognizes a vitest run that found no spec, also in colored output', () => {
  assert.equal(ranNoSpecs('No affected test files found\n'), true);
  assert.equal(ranNoSpecs('\x1b[33mNo test files found\x1b[39m, exiting with code 0'), true);
  assert.equal(ranNoSpecs(' Test Files  1 passed (1)\n'), false);
});

test('expects specs for a spec file and for a source with a spec beside it, not for the rest', () => {
  const repo = repoWithValueSpec();
  assert.deepEqual(
    filesExpectingSpecs(repo, ['libs/cli/src/value.ts', 'libs/cli/src/value.spec.ts', 'libs/cli/vitest.config.mts']),
    ['libs/cli/src/value.ts', 'libs/cli/src/value.spec.ts'],
  );
});

test('lints only changed top-level tools/scripts sources', () => {
  assert.deepEqual(
    toolFilesToLint([
      'tools/scripts/a.mjs',
      'tools/scripts/b.js',
      'tools/scripts/x/c.mjs',
      'libs/a.mjs',
      'tools/scripts/d.md',
    ]),
    ['tools/scripts/a.mjs', 'tools/scripts/b.js'],
  );
});

test('a staged tools/scripts file with a lint error blocks the commit', () => {
  const repo = repoWithValueSpec();
  write(repo, 'eslint.config.mjs', "export default [{ rules: { 'no-control-regex': 'error' } }];\n");
  write(repo, 'tools/scripts/bad.mjs', 'export const bad = /\\x1b/;\n');
  assert.equal(sh(repo, 'git', ['add', '.']).status, 0);
  const hook = sh(repo, 'sh', ['.husky/pre-commit']);
  assert.notEqual(hook.status, 0, hook.stdout + hook.stderr);
  assert.match(hook.stderr, /eslint fails in tools\/scripts/);
});

test('a tools spec in the index copy finds the real repo root through ETHLETE_REPO_ROOT', () => {
  const repo = repoWithValueSpec();
  write(repo, 'eslint.config.mjs', 'export default [];\n');
  write(repo, 'package.json', JSON.stringify({ scripts: { 'test:tools': 'node --test tools/scripts/*.spec.mjs' } }));
  write(
    repo,
    'tools/scripts/root.spec.mjs',
    `import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { test } from 'node:test';

test('root', () => {
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.env.ETHLETE_REPO_ROOT ?? process.cwd(), encoding: 'utf8' }).trim();
  assert.equal(realpathSync(top), realpathSync(${JSON.stringify(repo)}));
});
`,
  );
  assert.equal(sh(repo, 'git', ['add', '-A']).status, 0);
  assert.equal(sh(repo, 'git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'tools']).status, 0);
  write(repo, 'tools/scripts/root.spec.mjs', readFileSync(join(repo, 'tools/scripts/root.spec.mjs'), 'utf8') + '\n');
  assert.equal(sh(repo, 'git', ['add', 'tools/scripts/root.spec.mjs']).status, 0);
  const hook = sh(repo, 'sh', ['.husky/pre-commit']);
  assert.equal(hook.status, 0, hook.stdout + hook.stderr);
});

test('a vitest run that selects no spec for a source with a spec fails the gate', () => {
  const repo = repoWithValueSpec();
  write(
    repo,
    'libs/cli/vitest.config.mts',
    "import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({ test: { include: ['nothing/**/*.spec.ts'] } });\n",
  );
  write(repo, 'libs/cli/src/value.ts', 'export const value = 1 + 0;\n');
  assert.equal(sh(repo, 'git', ['add', '.']).status, 0);
  const hook = sh(repo, 'sh', ['.husky/pre-commit']);
  assert.notEqual(hook.status, 0, hook.stdout + hook.stderr);
  assert.match(hook.stderr, /ran no spec for cli/);
});

test('finds the libs whose dependency fields changed between two revisions', () => {
  const repo = mkdtempSync(join(tmpdir(), 'lib-build-gate-'));
  repos.push(repo);
  const manifest = (dependencies, version) => JSON.stringify({ version, dependencies }) + '\n';
  write(repo, 'libs/a/package.json', manifest({ x: '1' }, '1'));
  write(repo, 'libs/b/package.json', manifest({ y: '1' }, '1'));
  const commit = (message) => {
    assert.equal(sh(repo, 'git', ['add', '.']).status, 0);
    assert.equal(sh(repo, 'git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', message]).status, 0);
    return sh(repo, 'git', ['rev-parse', 'HEAD']).stdout.trim();
  };
  assert.equal(sh(repo, 'git', ['init', '-q']).status, 0);
  const base = commit('base');
  write(repo, 'libs/a/package.json', manifest({ x: '2' }, '1'));
  write(repo, 'libs/b/package.json', manifest({ y: '1' }, '2'));
  const head = commit('change');
  assert.deepEqual(libsWithChangedDependencies(repo, base, head), ['a']);
});
