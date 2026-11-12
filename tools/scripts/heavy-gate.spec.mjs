import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { parseGateArgs } from './heavy-gate.mjs';

const gate = new URL('./heavy-gate.mjs', import.meta.url).pathname;
const ran = ['--', process.execPath, '-e', 'console.log("ran")'];

const lockDir = (t, holder) => {
  const dir = mkdtempSync(join(tmpdir(), 'heavy-gate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  if (holder) writeFileSync(join(dir, 'ethlete-heavy-run.lock'), JSON.stringify({ name: 'push-suite', ...holder }));
  return dir;
};

const envOf = (dir, extra = {}) => {
  const env = { ...process.env };
  delete env['ETHLETE_HEAVY_RUN_HELD'];
  delete env['ETHLETE_HEAVY_NO_WAIT'];
  return {
    ...env,
    ETHLETE_HEAVY_LOCK_FILE: join(dir, 'ethlete-heavy-run.lock'),
    ETHLETE_HEAVY_POLL_MS: '100',
    ...extra,
  };
};

const runGate = (args, env) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [gate, 'test:tools', ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => done({ status, stdout, stderr }));
  });

test('a live push:suite holder makes --no-wait refuse with one line and exit 2', async (t) => {
  const dir = lockDir(t, { pid: process.pid, started: Date.now() });
  const run = await runGate(['--no-wait', ...ran], envOf(dir));
  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.match(
    run.stderr,
    /^test:tools: heavy run lock held by push-suite \(pid \d+, since .+\); run again after it ends\n$/,
  );
});

test('a live holder makes the command wait with one notice and run once the holder ends', async (t) => {
  const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 1500)']);
  const dir = lockDir(t, { pid: holder.pid, started: Date.now() });
  const startedAt = Date.now();
  const run = await runGate(ran, envOf(dir));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), 'ran');
  assert.match(run.stderr, new RegExp(`^test:tools: waiting for push-suite \\(pid ${holder.pid}, since .+\\)\\n$`));
  assert.ok(Date.now() - startedAt >= 1000, 'the command started only after the holder ended');
});

test('a live holder past the wait limit refuses with exit 2', async (t) => {
  const dir = lockDir(t, { pid: process.pid, started: Date.now() });
  const run = await runGate(ran, envOf(dir, { ETHLETE_HEAVY_MAX_WAIT_MS: '300' }));
  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
});

test('a dead holder does not block the command', async (t) => {
  const dead = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' });
  const dir = lockDir(t, { pid: Number(dead.stdout.trim()), started: Date.now() });
  const run = await runGate(['--no-wait', ...ran], envOf(dir));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), 'ran');
});

test("a push:suite child runs under its owner's lock", async (t) => {
  const dir = lockDir(t, { pid: process.pid, started: Date.now() });
  const run = await runGate(['--no-wait', ...ran], envOf(dir, { ETHLETE_HEAVY_RUN_HELD: String(process.pid) }));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), 'ran');
});

test('the command exit code passes through and --no-wait never reaches it', async (t) => {
  const dir = lockDir(t);
  const run = await runGate(
    ['--', process.execPath, '-e', 'console.log(process.argv.slice(1).join(" ")); process.exit(3)', 'a', '--no-wait'],
    envOf(dir),
  );
  assert.equal(run.status, 3);
  assert.equal(run.stdout.trim(), 'a');
  assert.deepEqual(parseGateArgs(['x', '--', 'cmd', '--no-wait']), { name: 'x', wait: false, command: ['cmd'] });
  assert.equal(parseGateArgs(['x', 'cmd']), undefined);
});
