import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { suitesForFiles } from './precommit-specs.mjs';

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
    'tools/scripts/cli-related-map.mjs',
    'tools/scripts/lint-css-properties.js',
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
});

test('maps staged files to the Studio and cli suites', () => {
  const suites = suitesForFiles(['apps/ethlete-studio/a.ts', 'libs/x/r.ts', 'README.md'], {
    'src/m.spec.ts': ['libs/x/*.ts'],
  });
  assert.deepEqual(
    suites.map((suite) => [suite.name, suite.files]),
    [
      ['Studio', ['apps/ethlete-studio/a.ts']],
      ['cli', ['libs/cli/src/m.spec.ts']],
    ],
  );
  assert.deepEqual(suitesForFiles(['README.md'], {}), []);
});
