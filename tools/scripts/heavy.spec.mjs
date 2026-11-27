import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { tempDir } from './temp-dir.mjs';

const script = new URL('./heavy.mjs', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const spawned = new Set();

after(() => {
  for (const child of spawned) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // the group has already exited
    }
  }
});

const setup = () => {
  const dir = tempDir('heavy-spec-');
  const env = {
    ...process.env,
    HEAVY_LOCK_PREFIX: join(dir, 'lock'),
    HEAVY_POLL_MS: '50',
    RUN_REGISTRY_DIR: join(dir, 'runs'),
  };
  const start = (cmd) => {
    const child = spawn('node', [script, 'run', '--', 'sh', '-c', cmd], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    spawned.add(child);
    child.out = '';
    child.err = '';
    child.stdout.on('data', (d) => (child.out += d));
    child.stderr.on('data', (d) => (child.err += d));
    child.done = new Promise((r) =>
      child.on('close', (code) => {
        spawned.delete(child);
        r(code);
      }),
    );
    return child;
  };
  return { dir, start };
};

const waitFor = async (cond) => {
  for (let i = 0; i < 200; i++) {
    if (cond()) return;
    await sleep(50);
  }
  assert.fail('timeout');
};

const holderLines = (err) => err.match(/slot \d: pid \d+/g) ?? [];

const holdUntil = (gate, tag) => `echo ${tag}; while [ ! -e ${gate} ]; do sleep 0.05; done`;

test('4 jobs: 3 run at once, the 4th waits and prints holders', { timeout: 30_000 }, async () => {
  const { dir, start } = setup();
  const gate = join(dir, 'go');
  const jobs = [1, 2, 3].map((i) => start(holdUntil(gate, `started-${i}`)));
  await waitFor(() => jobs.every((j) => j.out.includes('started-')));
  const fourth = start('echo fourth-ran');
  await waitFor(() => holderLines(fourth.err).length === 3);
  assert.equal(fourth.out, '');
  assert.match(fourth.err, /all 3 slots are taken/);
  writeFileSync(gate, '');
  assert.equal(await fourth.done, 0);
  assert.match(fourth.out, /fourth-ran/);
  await Promise.all(jobs.map((j) => j.done));
});

test('a killed holder frees its slot', { timeout: 30_000 }, async () => {
  const { dir, start } = setup();
  const gate = join(dir, 'go');
  const jobs = [1, 2, 3].map((i) => start(holdUntil(gate, `started-${i}`)));
  await waitFor(() => jobs.every((j) => j.out.includes('started-')));
  const fourth = start('echo fourth-ran');
  await waitFor(() => holderLines(fourth.err).length === 3);
  const pid = Number(fourth.err.match(/slot \d: pid (\d+)/)[1]);
  process.kill(pid, 'SIGKILL');
  assert.equal(await fourth.done, 0);
  assert.match(fourth.out, /fourth-ran/);
  writeFileSync(gate, '');
  await Promise.all(jobs.map((j) => j.done));
});

test('exit code passes through', { timeout: 30_000 }, async () => {
  const { start } = setup();
  assert.equal(await start('exit 7').done, 7);
  assert.equal(await start('exit 0').done, 0);
});

test('a malformed --fetch or unknown own option exits 2', { timeout: 30_000 }, async () => {
  const { dir } = setup();
  const stub = join(dir, 'remote-run-stub.mjs');
  writeFileSync(stub, "console.log('ARGS ' + JSON.stringify(process.argv.slice(2)));\n");
  const env = {
    ...process.env,
    HEAVY_LOCK_PREFIX: join(dir, 'lock'),
    RUN_REGISTRY_DIR: join(dir, 'runs'),
    HEAVY_REMOTE_RUN: stub,
  };
  const call = (args) =>
    new Promise((resolve) => {
      const child = spawn('node', [script, 'run', ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.on('close', (code) => resolve({ code, out }));
    });
  assert.equal((await call(['--fetch', 'a', '--bogus', 'x', '--', 'true'])).code, 2);
  assert.equal((await call(['--fetch', '--', 'true'])).code, 2);
});

test('a run writes its temp files into its own TMPDIR, which is gone after the run', async () => {
  const dir = tempDir('heavy-tmp-spec-');
  const root = join(dir, 'tmp');
  mkdirSync(root);
  const child = spawn(
    'node',
    [script, 'run', '--', 'sh', '-c', 'echo "$TMPDIR"; mktemp -d >/dev/null; ls -a "$TMPDIR" | grep -c jest_rs'],
    {
      env: { ...process.env, TMPDIR: root, HEAVY_LOCK_PREFIX: join(dir, 'lock'), RUN_REGISTRY_DIR: join(dir, 'runs') },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  assert.equal(await new Promise((r) => child.on('close', r)), 0);
  const [runTmp, linked] = out.trim().split('\n');
  assert.match(runTmp, /\/tmp\/heavy-run-\w{6}$/);
  assert.equal(linked, '1');
  assert.equal(existsSync(runTmp), false);
  assert.deepEqual(
    readdirSync(root)
      .filter((name) => !name.startsWith('.') && !name.startsWith('playwright-transform-cache-'))
      .sort(),
    ['et-design-harness-cache', 'jest_rs', 'node-compile-cache'],
  );
});
