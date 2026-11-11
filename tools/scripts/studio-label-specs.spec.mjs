import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { literalsOf, removedLiterals, staleSpecHits } from './studio-label-specs.mjs';
import { gitExec } from './git-test-env.mjs';

test('splits template literals around placeholders and drops short ones', () => {
  assert.deepEqual(literalsOf("a: (f: string) => `Kommentar zu ${f} danach`, b: 'ja'"), ['Kommentar zu', 'danach']);
});

test('keeps only removed texts that no longer exist in the file', () => {
  const diff = [
    '--- a/x',
    "-    staleGo: 'Go ist veraltet',",
    "-    noGo: 'Noch kein Go',",
    "+    staleGo: 'Go ist alt',",
  ].join('\n');
  assert.deepEqual(removedLiterals(diff, "noGo: 'Noch kein Go'"), ['Go ist veraltet']);
});

test('reports every spec line that asserts a removed text', () => {
  const hits = staleSpecHits(['Go ist veraltet'], () => ['a.spec.ts:3:expect(x).toBe("Go ist veraltet")']);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].literal, 'Go ist veraltet');
});

const script = fileURLToPath(new URL('./studio-label-specs.mjs', import.meta.url));
const labels = 'apps/ethlete-studio/src/app/i18n/studio-labels.ts';
const spec = 'apps/ethlete-studio/src/app/go.spec.ts';

const stagedRepo = () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-label-specs-'));
  const remote = mkdtempSync(join(tmpdir(), 'studio-label-specs-remote-'));
  const git = (...args) => gitExec(args, { cwd: root, encoding: 'utf8' });
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  gitExec(['init', '-q', '--bare', remote]);
  git('init', '-q', '-b', 'next');
  git('config', 'user.email', 'spec@example.com');
  git('config', 'user.name', 'spec');
  git('config', 'commit.gpgsign', 'false');
  write(labels, "export const labels = { staleGo: 'Go ist veraltet' };\n");
  git('add', '.');
  git('commit', '-q', '--no-verify', '-m', 'labels');
  git('remote', 'add', 'origin', remote);
  git('push', '-q', '-u', 'origin', 'next');
  return { root, remote, git, write };
};

const runStaged = (root) =>
  spawnSync('node', [script, '--staged'], { cwd: root, encoding: 'utf8', env: { ...process.env, NX_BASE: '' } });

test('--staged refuses a staged spec that asserts a label removed since the upstream', () => {
  const { root, remote, git, write } = stagedRepo();
  try {
    write(labels, "export const labels = { staleGo: 'Go ist alt' };\n");
    git('commit', '-q', '--no-verify', '-am', 'rename');
    write(spec, "expect(text).toBe('Go ist veraltet');\n");
    git('add', spec);

    const result = runStaged(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /go\.spec\.ts:1:[^]*asserts removed label text "Go ist veraltet"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(remote, { recursive: true, force: true });
  }
});

test('--staged passes a staged spec that asserts a label the app still has', () => {
  const { root, remote, git, write } = stagedRepo();
  try {
    write(spec, "expect(text).toBe('Go ist veraltet');\n");
    git('add', spec);

    assert.equal(runStaged(root).status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(remote, { recursive: true, force: true });
  }
});
