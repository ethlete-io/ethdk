import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';
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

const sdk = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
const created = [];

after(() => created.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const put = (repo, file, text) => {
  mkdirSync(dirname(join(repo, file)), { recursive: true });
  writeFileSync(join(repo, file), text);
};

const leftovers = (tmp) => readdirSync(tmp).filter((name) => /^(yarn-commit|pre-commit)/.test(name));

const repoWithCommitTool = () => {
  const repo = mkdtempSync(join(tmpdir(), 'commit-wait-repo-'));
  const tmp = mkdtempSync(join(tmpdir(), 'commit-wait-tmp-'));
  created.push(repo, tmp);
  for (const file of [
    '.husky/pre-commit',
    'tools/scripts/commit-wait.mjs',
    'tools/scripts/precommit-specs.mjs',
    'tools/scripts/link-node-modules.mjs',
    'tools/scripts/cli-related-map.mjs',
    'tools/scripts/lint-css-properties.js',
    'tools/scripts/sketch-round-ready.mjs',
    'tools/scripts/lint-changesets.js',
  ]) {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    copyFileSync(join(sdk, file), join(repo, file));
  }
  symlinkSync(join(sdk, 'node_modules'), join(repo, 'node_modules'));
  put(repo, '.gitignore', 'node_modules\n');
  put(repo, 'eslint.config.mjs', 'export default [];\n');
  put(
    repo,
    'libs/cli/vitest.config.mts',
    "import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({ test: { include: ['src/**/*.spec.ts'] } });\n",
  );
  put(repo, 'libs/cli/src/value.ts', 'export const value = 1;\n');
  put(
    repo,
    'libs/cli/src/value.spec.ts',
    "import { expect, test } from 'vitest';\nimport { value } from './value';\n\ntest('value', () => expect(value).toBe(1));\n",
  );
  const env = { ...cleanEnv, TMPDIR: tmp };
  const run = (command, args, extra = {}) =>
    spawnSync(command, args, { cwd: repo, env: { ...env, ...extra }, encoding: 'utf8' });
  for (const args of [
    ['init', '-q'],
    ['config', 'user.name', 't'],
    ['config', 'user.email', 't@t'],
    ['config', 'core.hooksPath', '.husky'],
    ['add', '.'],
    ['commit', '-qm', 'base'],
  ]) {
    assert.equal(run('git', args).status, 0);
  }
  const yarnCommit = (args, extra) => run('node', ['tools/scripts/commit-wait.mjs', ...args], extra);
  const worktrees = () => run('git', ['worktree', 'list', '--porcelain']).stdout.match(/^worktree /gm).length;
  return { repo, tmp, run, yarnCommit, worktrees };
};

test('runs the path specs before the lock in a worktree without foreign edits, and the hook skips them', () => {
  const { repo, tmp, run, yarnCommit, worktrees } = repoWithCommitTool();
  put(repo, 'libs/cli/src/value.ts', 'export const value = 3;\n');
  put(
    repo,
    'libs/cli/src/lock.spec.ts',
    `import { existsSync } from 'node:fs';\nimport { expect, test } from 'vitest';\nimport { value } from './value';\n\ntest('lock', () => {\n  expect(value).toBe(1);\n  expect(existsSync(${JSON.stringify(join(repo, '.git/index.lock'))})).toBe(false);\n});\n`,
  );
  assert.equal(run('git', ['add', '-N', 'libs/cli/src/lock.spec.ts']).status, 0);

  const result = yarnCommit(['-qm', 'lock', '--', 'libs/cli/src/lock.spec.ts']);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /specs already ran for this exact tree/);
  assert.deepEqual(run('git', ['show', '--name-only', '--format=', 'HEAD']).stdout.trim().split('\n'), [
    'libs/cli/src/lock.spec.ts',
  ]);
  assert.equal(worktrees(), 1);
  assert.deepEqual(leftovers(tmp), []);
});

test('a new untracked changeset needs no git add, and a docs commit landing during the specs keeps the hook skip', () => {
  const { repo, tmp, run, yarnCommit, worktrees } = repoWithCommitTool();
  const ran = join(tmp, '..', `${basename(repo)}-race-ran`);
  created.push(ran);
  put(
    repo,
    'libs/cli/src/race.spec.ts',
    `import { spawnSync } from 'node:child_process';\nimport { existsSync, writeFileSync } from 'node:fs';\nimport { expect, test } from 'vitest';\nimport { value } from './value';\n\ntest('race', () => {\n  expect(value).toBe(1);\n  if (existsSync(${JSON.stringify(ran)})) return;\n  writeFileSync(${JSON.stringify(ran)}, '');\n  writeFileSync(${JSON.stringify(join(repo, 'plans/STATUS.md'))}, 'B204\\n');\n  const git = (args) => spawnSync('git', args, { cwd: ${JSON.stringify(repo)} }).status;\n  expect(git(['commit', '-qm', 'docs(repo): Record B204', '--', 'plans/STATUS.md'])).toBe(0);\n});\n`,
  );
  put(repo, 'plans/STATUS.md', 'B203\n');
  writeFileSync(ran, '');
  assert.equal(run('git', ['add', 'libs/cli/src/race.spec.ts', 'plans/STATUS.md']).status, 0);
  assert.equal(run('git', ['commit', '-qm', 'race', '--', 'libs/cli/src/race.spec.ts', 'plans/STATUS.md']).status, 0);
  rmSync(ran);
  put(repo, 'libs/cli/src/value.ts', 'export const value = 2 - 1;\n');
  put(
    repo,
    '.changeset/studio-vitest-console-error.md',
    "---\n'ethlete-studio': none\n---\n\nThe Studio vitest setup stubs `ResizeObserver` and `document.fonts`, and fails any spec that logs `console.error`.\n",
  );

  const result = yarnCommit([
    '-qm',
    'test(repo): Fail Studio specs that log console.error',
    '--',
    'libs/cli/src/value.ts',
    '.changeset/studio-vitest-console-error.md',
  ]);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /specs already ran in yarn commit; the 1 files committed since select no specs/);
  assert.equal(result.stdout.match(/Test Files/g)?.length, 1, result.stdout);
  assert.deepEqual(run('git', ['show', '--name-only', '--format=', 'HEAD']).stdout.trim().split('\n'), [
    '.changeset/studio-vitest-console-error.md',
    'libs/cli/src/value.ts',
  ]);
  assert.equal(run('git', ['log', '-1', '--format=%s', 'HEAD^']).stdout.trim(), 'docs(repo): Record B204');
  assert.equal(worktrees(), 1);
  assert.deepEqual(leftovers(tmp), []);
});

test('a plain git commit with a stale marker still runs the specs in the hook', () => {
  const { repo, run } = repoWithCommitTool();
  const stale = run('git', ['rev-parse', 'HEAD^{tree}']).stdout.trim();
  put(repo, 'libs/cli/src/value.ts', 'export const value = 3;\n');

  const result = run('git', ['commit', '-qm', 'broken', '--', 'libs/cli/src/value.ts'], {
    PRECOMMIT_SPECS_TREE: stale,
  });

  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /a cli spec related to the staged files fails/);
});

test('a failing or timed-out path spec blocks the commit and removes the worktree', () => {
  const { repo, tmp, run, yarnCommit, worktrees } = repoWithCommitTool();
  const head = run('git', ['rev-parse', 'HEAD']).stdout;
  put(repo, 'libs/cli/src/value.ts', 'export const value = 3;\n');

  for (const extra of [{}, { PRECOMMIT_SPECS_TIMEOUT_MS: '1' }]) {
    const result = yarnCommit(['-qm', 'broken', '--', 'libs/cli/src/value.ts'], extra);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(run('git', ['rev-parse', 'HEAD']).stdout, head);
    assert.equal(worktrees(), 1);
    assert.deepEqual(leftovers(tmp), []);
  }
});

test('re-runs a spec that failed only by timeout alone once, end to end', () => {
  const { repo, tmp, run, yarnCommit, worktrees } = repoWithCommitTool();
  const marker = join(tmp, '..', `${basename(repo)}-slow-ran`);
  created.push(marker);
  put(
    repo,
    'libs/cli/src/slow.spec.ts',
    `import { existsSync, writeFileSync } from 'node:fs';\nimport { test } from 'vitest';\n\ntest('slow once', { timeout: 300 }, async () => {\n  if (existsSync(${JSON.stringify(marker)})) return;\n  writeFileSync(${JSON.stringify(marker)}, '');\n  await new Promise((done) => setTimeout(done, 2000));\n});\n`,
  );
  assert.equal(run('git', ['add', '-N', 'libs/cli/src/slow.spec.ts']).status, 0);

  const result = yarnCommit(['-qm', 'slow', '--', 'libs/cli/src/slow.spec.ts']);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /slow\.spec\.ts failed only by timeout; re-running alone once/);
  assert.match(result.stderr, /slow\.spec\.ts passed when re-run alone; the timeout above does not fail the commit/);
  assert.match(result.stderr, /specs already ran for this exact tree/);
  assert.equal(worktrees(), 1);
  assert.deepEqual(leftovers(tmp), []);
});

test('runs the related specs when TMPDIR is a symlink', () => {
  const { repo, tmp, run, yarnCommit } = repoWithCommitTool();
  const link = `${tmp}-link`;
  symlinkSync(tmp, link);
  created.push(link);
  const head = run('git', ['rev-parse', 'HEAD']).stdout;
  put(repo, 'libs/cli/src/value.ts', 'export const value = 2;\n');

  const result = yarnCommit(['-qm', 'broken', '--', 'libs/cli/src/value.ts'], { TMPDIR: link });

  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /value\.spec\.ts/);
  assert.equal(run('git', ['rev-parse', 'HEAD']).stdout, head);
});

test('a type error vitest passes blocks the commit, an older one in an untouched spec too', () => {
  const { repo, run, yarnCommit } = repoWithCommitTool();
  put(
    repo,
    'libs/cli/tsconfig.spec.json',
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        target: 'es2022',
        skipLibCheck: true,
        types: [],
      },
      include: ['src/**/*.ts'],
    }),
  );
  put(
    repo,
    'libs/cli/src/old.spec.ts',
    "import { test } from 'vitest';\n\nconst old: number = 'old' as unknown as string;\ntest('old', () => void old);\n",
  );
  run('git', ['add', '--', 'libs/cli/tsconfig.spec.json', 'libs/cli/src/old.spec.ts']);
  run('git', ['commit', '-qm', 'old type error', '--no-verify']);
  const head = run('git', ['rev-parse', 'HEAD']).stdout;

  put(
    repo,
    'libs/cli/src/value.spec.ts',
    "import { expect, test } from 'vitest';\nimport { value } from './value';\n\nconst typed: number = 'one' as unknown as string;\ntest('value', () => expect(value + Number(typed)).toBeNaN());\n",
  );
  const refused = yarnCommit(['-qm', 'typed', '--', 'libs/cli/src/value.spec.ts']);
  assert.notEqual(refused.status, 0, refused.stdout + refused.stderr);
  assert.match(refused.stderr, /libs\/cli\/src\/value\.spec\.ts\(4,7\): error TS2322/);
  assert.match(refused.stderr, /libs\/cli\/tsconfig\.spec\.json has type errors/);
  assert.match(refused.stderr, /libs\/cli\/src\/old\.spec\.ts\(3,7\): error TS2322/);
  assert.equal(run('git', ['rev-parse', 'HEAD']).stdout, head);

  put(
    repo,
    'libs/cli/src/value.spec.ts',
    "import { expect, test } from 'vitest';\nimport { value } from './value';\n\ntest('value', () => expect(value).toBe(1));\ntest('more', () => expect(value + 1).toBe(2));\n",
  );
  const stillOld = yarnCommit(['-qm', 'clean', '--', 'libs/cli/src/value.spec.ts']);
  assert.match(stillOld.stderr, /old\.spec\.ts\(3,7\)/);
  assert.equal(run('git', ['rev-parse', 'HEAD']).stdout, head);

  put(repo, 'libs/cli/src/old.spec.ts', "import { test } from 'vitest';\n\ntest('old', () => undefined);\n");
  const passed = yarnCommit(['-qm', 'clean', '--', 'libs/cli/src/value.spec.ts', 'libs/cli/src/old.spec.ts']);
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
});

test('a lint error in a project of the staged files blocks yarn commit and a plain git commit, docs files lint nothing', () => {
  const { repo, run, yarnCommit } = repoWithCommitTool();
  put(repo, 'package.json', JSON.stringify({ name: 'repo', private: true }));
  put(repo, 'nx.json', JSON.stringify({}));
  put(
    repo,
    'libs/cli/project.json',
    JSON.stringify({
      name: 'cli',
      targets: { lint: { executor: 'nx:run-commands', options: { command: 'eslint src', cwd: 'libs/cli' } } },
    }),
  );
  put(
    repo,
    'libs/cli/eslint.config.mjs',
    "export default [{ files: ['**/*.ts'], rules: { 'no-debugger': 'error' } }];\n",
  );
  run('git', ['add', '.']);
  run('git', ['commit', '-qm', 'nx', '--no-verify']);
  const head = run('git', ['rev-parse', 'HEAD']).stdout;

  put(repo, 'libs/cli/src/value.ts', 'debugger;\nexport const value = 1;\n');
  const refused = yarnCommit(['-qm', 'lint', '--', 'libs/cli/src/value.ts']);
  assert.notEqual(refused.status, 0, refused.stdout + refused.stderr);
  assert.match(refused.stdout + refused.stderr, /no-debugger/);
  assert.match(refused.stderr, /lint fails in cli/);
  assert.equal(run('git', ['rev-parse', 'HEAD']).stdout, head);

  const plain = run('git', ['commit', '-qm', 'plain', '-i', '--', 'libs/cli/src/value.ts']);
  assert.notEqual(plain.status, 0, plain.stdout + plain.stderr);
  assert.match(plain.stderr, /lint fails in cli/);
  assert.equal(run('git', ['rev-parse', 'HEAD']).stdout, head);

  put(repo, 'libs/cli/NOTES.md', 'notes\n');
  const docs = yarnCommit(['-qm', 'docs', '--', 'libs/cli/NOTES.md']);
  assert.equal(docs.status, 0, docs.stdout + docs.stderr);

  put(repo, 'libs/cli/src/value.ts', 'export const value = 1;\nexport const other = 2;\n');
  const passed = yarnCommit(['-qm', 'clean', '--', 'libs/cli/src/value.ts']);
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
});

test('a change in a test:tools spec directory runs its specs and a failing one blocks the commit', () => {
  const { repo, run, yarnCommit } = repoWithCommitTool();
  put(repo, 'package.json', JSON.stringify({ scripts: { 'test:tools': 'node --test tools/lint/*.spec.mjs' } }));
  run('git', ['add', 'package.json']);
  run('git', ['commit', '-qm', 'manifest', '--no-verify']);
  put(repo, 'tools/lint/double.mjs', 'export const double = (n) => n * 2;\n');
  put(
    repo,
    'tools/lint/double.spec.mjs',
    "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { double } from './double.mjs';\n\ntest('double', () => assert.equal(double(2), 4));\n",
  );
  const added = yarnCommit(['-qm', 'double', '--', 'tools/lint/double.mjs', 'tools/lint/double.spec.mjs']);
  assert.equal(added.status, 0, added.stdout + added.stderr);
  const head = run('git', ['rev-parse', 'HEAD']).stdout;

  put(repo, 'tools/lint/double.mjs', 'export const double = (n) => n * 3;\n');
  const refused = yarnCommit(['-qm', 'triple', '--', 'tools/lint/double.mjs']);
  assert.notEqual(refused.status, 0, refused.stdout + refused.stderr);
  assert.match(refused.stderr, /a tools\/lint spec fails/);
  assert.equal(run('git', ['rev-parse', 'HEAD']).stdout, head);
});
