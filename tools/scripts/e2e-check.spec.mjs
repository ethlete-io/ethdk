import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as check from './e2e-check.mjs';
import { judgeSuiteRun, runSuite } from './e2e-check.mjs';
import { mapChanged } from './e2e-map.mjs';

const fixture = (body) => {
  const file = join(mkdtempSync(join(tmpdir(), 'e2e-check-spec-')), 'suite.e2e.mjs');
  writeFileSync(file, body);
  return file;
};

const run = (body, options = {}) =>
  runSuite(process.cwd(), 'fixture', undefined, { script: fixture(body), ...options });

test('a suite that throws before its first case is red', async () => {
  const result = await run(`throw new Error('fixture crashed');`);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'crashed before its first case');
});

test('a suite that runs zero cases is red even when it exits 0', async () => {
  const result = await run(`console.log('\\n0/0 passed'); process.exit(0);`);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ran zero cases');
});

test('a suite with a silent exit 0 is red', async () => {
  assert.equal((await run(`process.exit(0);`)).ok, false);
});

test('a suite with passing cases is green and a failing case is red', async () => {
  assert.equal((await run(`console.log('PASS  a'); console.log('\\n1/1 passed');`)).ok, true);
  const failed = await run(`console.log('FAIL  a'); console.log('\\n0/1 passed'); process.exit(1);`);
  assert.equal(failed.reason, 'failed');
});

test('a running suite prints a progress line', async () => {
  const lines = [];
  await run(`console.log('PASS  a'); await new Promise((r) => setTimeout(r, 400)); console.log('\\n1/1 passed');`, {
    heartbeatMs: 100,
    onLine: (line) => lines.push(line),
  });
  assert.ok(lines.includes('PASS  a'));
  assert.ok(lines.some((line) => line.startsWith('... running') && line.includes('1 case(s) done')));
});

test('a timeout is red', () => {
  assert.equal(judgeSuiteRun({ status: null, timedOut: true, output: 'PASS a' }).ok, false);
});

test('sketch, design-canvas and system-view files map to canvas', () => {
  const base = 'apps/ethlete-studio/src/app';
  const { suites } = mapChanged([
    `${base}/design-parts/sketches/a.ts`,
    `${base}/components/design-canvas/b.ts`,
    `${base}/system-view/anything-else.ts`,
  ]);
  assert.ok(suites.includes('canvas'));
  assert.deepEqual(mapChanged([`${base}/system-view/x.ts`]).suites, ['canvas']);
});

const sh = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

test('the worktree is the named revision, not the dirty main tree, and is removed afterwards', () => {
  const repo = mkdtempSync(join(tmpdir(), 'e2e-check-repo-'));
  sh(repo, 'init', '-q');
  sh(repo, 'config', 'user.email', 'a@b.c');
  sh(repo, 'config', 'user.name', 'x');
  writeFileSync(join(repo, 'file.txt'), 'committed');
  sh(repo, 'add', 'file.txt');
  sh(repo, 'commit', '-q', '-m', 'one');
  const sha = sh(repo, 'rev-parse', 'HEAD');
  writeFileSync(join(repo, 'file.txt'), 'dirty');
  writeFileSync(join(repo, 'new.txt'), 'untracked');
  const indexBefore = sh(repo, 'status', '--porcelain');
  const tree = check.createRevisionWorktree(repo, sha);

  try {
    assert.equal(tree.sha, sha);
    assert.equal(sh(tree.dir, 'rev-parse', 'HEAD'), sha);
    assert.equal(readFileSync(join(tree.dir, 'file.txt'), 'utf8'), 'committed');
    assert.equal(existsSync(join(tree.dir, 'new.txt')), false);
    assert.equal(sh(repo, 'status', '--porcelain'), indexBefore);
  } finally {
    tree.remove();
  }

  assert.equal(existsSync(tree.dir), false);
  assert.ok(!sh(repo, 'worktree', 'list').includes(tree.dir));
});

test('the result line carries the sha the suite ran at and no worktree is left behind', () => {
  const repo = sh(process.cwd(), 'rev-parse', '--show-toplevel');
  const sha = sh(repo, 'rev-parse', '9e7ebf434');
  const before = sh(repo, 'worktree', 'list');
  const out = spawnSync('node', ['tools/scripts/e2e-check.mjs', sha, '--list'], { cwd: repo, encoding: 'utf8' }).stdout;
  assert.ok(out.split('\n').some((line) => line.startsWith('E2E ') && line.includes(`suite sha ${sha}`)));
  assert.equal(sh(repo, 'worktree', 'list'), before);
});

test('a suite that goes silent is killed after the idle limit and names the last case it reached', async () => {
  const result = await run(`console.log('PASS  first case'); await new Promise(() => setInterval(() => {}, 1000));`, {
    idleMs: 300,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /^no output for \d+s$/);
  assert.equal(result.lastCase, 'PASS  first case');
});
