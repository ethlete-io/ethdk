import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const sdk = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const created = [];

after(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

const ORIGINAL_NOTE = '`no-silent-catch-error` also flags a `try/catch` whose catch ignores the error.';

const changeset = (frontmatter, note = ORIGINAL_NOTE) => `---\n${frontmatter}\n---\n\n${note}\n`;

const REAL_BEFORE = changeset("'@ethlete/eslint-plugin': patch");
const REAL_AFTER = changeset(
  "'ethlete-studio': patch\n'@ethlete/cli': patch",
  'Lint now rejects a try/catch in Studio.',
);

const put = (repo, file, content) => {
  mkdirSync(dirname(join(repo, file)), { recursive: true });
  writeFileSync(join(repo, file), content);
};

const fixture = (initial, preChangesets = []) => {
  const repo = mkdtempSync(join(tmpdir(), 'changeset-coverage-'));
  created.push(repo);
  mkdirSync(join(repo, 'tools/scripts'), { recursive: true });
  copyFileSync(
    join(sdk, 'tools/scripts/check-changeset-coverage.js'),
    join(repo, 'tools/scripts/check-changeset-coverage.js'),
  );
  put(repo, 'package.json', JSON.stringify({ workspaces: [] }));
  put(repo, '.changeset/pre.json', JSON.stringify({ mode: 'pre', tag: 'next', changesets: preChangesets }));
  put(repo, '.changeset/silent-catch-try-catch.md', initial);

  const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.name', 't');
  git('config', 'user.email', 't@example.com');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD').stdout.trim();

  const commit = (change) => {
    change(repo);
    git('add', '-A');
    git('commit', '-q', '-m', 'change');
  };

  const check = () =>
    spawnSync('node', ['tools/scripts/check-changeset-coverage.js'], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, NX_BASE: base, NX_HEAD: 'HEAD' },
    });

  return { commit, check };
};

const rewrite = (content) => (repo) => put(repo, '.changeset/silent-catch-try-catch.md', content);

describe('check-changeset-coverage dropped changesets', () => {
  test('fails when the range deletes a changeset', () => {
    const { commit, check } = fixture(REAL_BEFORE);
    commit((repo) => unlinkSync(join(repo, '.changeset/silent-catch-try-catch.md')));

    const result = check();

    assert.equal(result.status, 1);
    assert.match(result.stderr, /silent-catch-try-catch\.md is deleted `@ethlete\/eslint-plugin`/);
    assert.match(result.stderr, /add a new changeset file/);
  });

  test('fails when a package entry is removed, as in d7f6169e6', () => {
    const { commit, check } = fixture(REAL_BEFORE);
    commit(rewrite(REAL_AFTER));

    const result = check();

    assert.equal(result.status, 1);
    assert.match(result.stderr, /silent-catch-try-catch\.md no longer lists `@ethlete\/eslint-plugin`/);
  });

  test('passes on a text-only rewrite', () => {
    const { commit, check } = fixture(REAL_BEFORE);
    commit(rewrite(changeset("'@ethlete/eslint-plugin': patch", 'A shorter note.')));

    assert.equal(check().status, 0);
  });

  test('passes when the package entry is kept and another is added', () => {
    const { commit, check } = fixture(REAL_BEFORE);
    commit(rewrite(changeset("'@ethlete/eslint-plugin': patch\n'@ethlete/cli': patch")));

    assert.equal(check().status, 0);
  });

  test('passes when the file is listed in pre.json', () => {
    const { commit, check } = fixture(REAL_BEFORE, ['silent-catch-try-catch']);
    commit(rewrite(REAL_AFTER));

    assert.equal(check().status, 0);
  });

  test('passes when a released changeset is deleted', () => {
    const { commit, check } = fixture(REAL_BEFORE, ['silent-catch-try-catch']);
    commit((repo) => unlinkSync(join(repo, '.changeset/silent-catch-try-catch.md')));

    assert.equal(check().status, 0);
  });
});
