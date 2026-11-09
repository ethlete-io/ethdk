import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as check from './e2e-check.mjs';
import { judgeSuiteRun, runSuite } from './e2e-check.mjs';
import { mapChanged, suiteInvocation } from './e2e-map.mjs';

const scratchDirs = [];
const scratch = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
};

after(() => scratchDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const fixture = (body) => {
  const file = join(scratch('e2e-check-spec-'), 'suite.e2e.mjs');
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

test('a failed case in the list format is a failure, not a crash before the first case', () => {
  const output = readFileSync(join(import.meta.dirname, 'fixtures/studio-e2e-repeat/run-stable.txt'), 'utf8');

  assert.equal(judgeSuiteRun({ status: 1, output }).reason, 'failed');
});

test('sketch, design-canvas and system-view files map to canvas', () => {
  const base = 'apps/ethlete-studio/src/app';
  const { suites } = mapChanged([
    `${base}/design-parts/sketches/a.ts`,
    `${base}/components/design-canvas/b.ts`,
    `${base}/system-view/anything-else.ts`,
  ]);
  assert.deepEqual(suites, ['canvas-flow', 'canvas-sketches', 'canvas-system', 'sketches-tree', 'studio-menu']);
  assert.deepEqual(mapChanged([`${base}/system-view/x.ts`]).suites, [
    'canvas-flow',
    'canvas-sketches',
    'canvas-system',
  ]);
});

test('a change to one view runs only that view', () => {
  const base = 'apps/ethlete-studio/src/app/system-view';
  assert.deepEqual(mapChanged([`${base}/flow-view.component.ts`]).suites, ['canvas-flow']);
  assert.deepEqual(mapChanged([`${base}/sketch-view.component.ts`]).suites, ['canvas-sketches', 'sketches-tree']);
  assert.deepEqual(mapChanged([`${base}/system-view.component.ts`]).suites, ['canvas-system', 'page-switch']);
});

test('the canvas e2e file itself runs every view, another e2e file only itself', () => {
  const e2e = 'apps/ethlete-studio/e2e';
  assert.deepEqual(mapChanged([`${e2e}/canvas.e2e.mjs`]).suites, ['canvas-flow', 'canvas-sketches', 'canvas-system']);
  assert.deepEqual(mapChanged([`${e2e}/page-switch.e2e.mjs`]).suites, ['page-switch']);
});

test('a canvas view suite runs canvas.e2e with --view', () => {
  assert.deepEqual(suiteInvocation('canvas-flow'), {
    script: 'apps/ethlete-studio/e2e/canvas.e2e.mjs',
    args: ['--view', 'flow'],
  });
  assert.equal(suiteInvocation('page-switch').script, 'apps/ethlete-studio/e2e/page-switch.e2e.mjs');
});

const sh = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

test('the worktree is the named revision, not the dirty main tree, and is removed afterwards', () => {
  const repo = scratch('e2e-check-repo-');
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

test('the result line carries the sha the suite ran at and its own worktree is removed', () => {
  const repo = sh(process.env.ETHLETE_REPO_ROOT ?? process.cwd(), 'rev-parse', '--show-toplevel');
  const sha = sh(repo, 'rev-parse', '9e7ebf434');
  const out = spawnSync('node', ['tools/scripts/e2e-check.mjs', sha, '--list'], { cwd: repo, encoding: 'utf8' }).stdout;
  const dir = /, tree (\S+)\)/.exec(out)?.[1];
  assert.ok(dir, out);
  assert.ok(out.split('\n').some((line) => line.startsWith('E2E ') && line.includes(`suite sha ${sha}`)));
  assert.equal(existsSync(dir), false);
  assert.ok(!sh(repo, 'worktree', 'list').includes(dir));
});

test('a suite that goes silent is killed after the idle limit and names the last case it reached', async () => {
  const result = await run(`console.log('PASS  first case'); await new Promise((r) => setTimeout(r, 6000));`, {
    idleMs: 300,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /^no output for \d+s$/);
  assert.equal(result.lastCase, 'PASS  first case');
});

const TIMING_FAIL = `console.log('PASS  a'); console.log('FAIL  [timing] b (budget 2000 ms)'); process.exit(1);`;

test('every run reports the load and core count sampled at the end', async () => {
  const result = await run(`console.log('PASS  a'); console.log('\\n1/1 passed');`, {
    sample: () => ({ load: 3.5, cores: 8 }),
  });
  assert.equal(result.load, 3.5);
  assert.equal(result.cores, 8);
});

test('a timing case that fails above the core count is not measured', async () => {
  const result = await run(TIMING_FAIL, { sample: () => ({ load: 12, cores: 8 }) });
  assert.equal(result.ok, false);
  assert.equal(result.notMeasured, true);
  assert.equal(result.reason, 'NOT MEASURED (load 12.0)');
});

test('a timing case that fails at or below the core count is a real failure', async () => {
  const result = await run(TIMING_FAIL, { sample: () => ({ load: 8, cores: 8 }) });
  assert.equal(result.notMeasured, undefined);
  assert.equal(result.reason, 'failed');
});

test('a behaviour case that fails under load is still a failure', async () => {
  const result = await run(`console.log('FAIL  [timing] a'); console.log('FAIL  b'); process.exit(1);`, {
    sample: () => ({ load: 99, cores: 8 }),
  });
  assert.equal(result.notMeasured, undefined);
  assert.equal(result.reason, 'failed');
});

test('a suite that goes idle under load is a timeout, not NOT MEASURED', () => {
  const result = judgeSuiteRun({ status: null, idle: 5000, output: 'FAIL  [timing] a', load: 99, cores: 8 });
  assert.equal(result.notMeasured, undefined);
});

test('a started case is the last case reached when the suite then goes silent', async () => {
  const result = await run(`console.log('RUN   [timing] slow one'); await new Promise((r) => setTimeout(r, 6000));`, {
    idleMs: 300,
  });
  assert.equal(result.lastCase, 'RUN   [timing] slow one');
});

const fakeTree = ({ recorded, hashOf = 'h1', link }) => {
  const dir = mkdtempSync(join(tmpdir(), 'b267b-tree-'));
  const dist = link ?? join(dir, 'dist/libs/cli');
  mkdirSync(join(dist, 'src/lib'), { recursive: true });
  writeFileSync(join(dist, 'src/index.js'), '');
  writeFileSync(join(dist, 'src/lib/source-hash.js'), `exports.cliSourceHash = () => ${JSON.stringify(hashOf)};`);
  writeFileSync(join(dist, 'build-info.json'), JSON.stringify({ sourceHash: recorded }));
  mkdirSync(join(dir, 'libs/cli/src/lib'), { recursive: true });
  writeFileSync(join(dir, 'libs/cli/src/lib/source-hash.ts'), '');
  if (link) {
    mkdirSync(join(dir, 'dist/libs'), { recursive: true });
    symlinkSync(link, join(dir, 'dist/libs/cli'));
  }
  return dir;
};

test('cliBuildProblem passes for a dist built from the tree', () => {
  const dir = fakeTree({ recorded: 'h1' });
  assert.equal(check.cliBuildProblem(dir), undefined);
  rmSync(dir, { recursive: true, force: true });
});

test('cliBuildProblem fails for a dist built from other sources', () => {
  const dir = fakeTree({ recorded: 'other' });
  assert.match(check.cliBuildProblem(dir), /not built from the tree revision/);
  rmSync(dir, { recursive: true, force: true });
});

test('cliBuildProblem fails for a dist symlinked out of the tree', () => {
  const outside = mkdtempSync(join(tmpdir(), 'b267b-out-'));
  const dir = fakeTree({ recorded: 'h1', link: join(outside, 'cli') });
  assert.match(check.cliBuildProblem(dir), /resolves outside/);
  rmSync(dir, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

test('cliBuildProblem skips the hash for a revision before the guard', () => {
  const dir = fakeTree({ recorded: 'other' });
  rmSync(join(dir, 'libs/cli/src/lib/source-hash.ts'));
  assert.equal(check.cliBuildProblem(dir), undefined);
  rmSync(dir, { recursive: true, force: true });
});

test('a harness phase line carries the wall time and the seconds since the harness started', async () => {
  const { phaseLine } = await import('./verify-studio-headless.mjs');
  assert.equal(
    phaseLine('design server ready on port 4500', Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1, 0, 0, 12, 340)),
    '[studio-headless 2026-01-01T00:00:12.340Z +12.3s] design server ready on port 4500',
  );
});
