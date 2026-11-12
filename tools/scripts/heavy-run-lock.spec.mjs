import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readHolder, takeHeavyLock } from './heavy-run-lock.mjs';

const lockFile = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'heavy-run-lock-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'heavy-run.lock');
};

const runner = (file, name, holdMs) => {
  const script = `
    const { takeHeavyLock, holderLine } = await import(${JSON.stringify(new URL('./heavy-run-lock.mjs', import.meta.url).href)});
    const lock = await takeHeavyLock(${JSON.stringify(name)}, { file: ${JSON.stringify(file)}, wait: false, env: {} });
    console.log(lock.ok ? 'took' : 'refused ' + holderLine(lock.holder));
    if (lock.ok) await new Promise((done) => setTimeout(done, ${holdMs}));
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  let out = '';
  child.stdout.on('data', (chunk) => (out += chunk));
  const done = new Promise((resolve) => child.on('close', () => resolve(out.trim())));
  return { child, done };
};

const until = async (check) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((done) => setTimeout(done, 50));
};

test('two runners on one machine: the second stops with the holder name', async (t) => {
  const file = lockFile(t);
  const first = runner(file, 'push-suite', 3000);
  await until(() => readHolder(file));
  const second = runner(file, 'spec:stress', 0);
  assert.match(await second.done, new RegExp(`^refused heavy run lock held by push-suite \\(pid ${first.child.pid},`));
  assert.equal(await first.done, 'took');
});

test('a waiting runner takes the lock after the holder ends', async (t) => {
  const file = lockFile(t);
  const first = runner(file, 'push-suite', 500);
  await until(() => readHolder(file));
  const lines = [];
  const lock = await takeHeavyLock('spec:stress', { file, env: {}, pollMs: 100, log: (line) => lines.push(line) });
  assert.equal(lock.ok, true);
  assert.equal(await first.done, 'took');
  assert.match(lines.join('\n'), /^spec:stress: heavy run lock held by push-suite .*; waiting$/);
  assert.equal(readHolder(file).name, 'spec:stress');
  lock.release();
  assert.equal(readHolder(file), undefined);
});

test('the lock of a dead holder is taken over', async (t) => {
  const file = lockFile(t);
  const dead = spawn(process.execPath, ['-e', '']);
  await new Promise((done) => dead.on('close', done));
  writeFileSync(file, JSON.stringify({ pid: dead.pid, name: 'push-suite', started: 0 }));
  const lock = await takeHeavyLock('spec:stress', { file, wait: false, env: {} });
  assert.equal(lock.ok, true);
  lock.release();
});

test('a child of a holder takes no lock of its own', async (t) => {
  const file = lockFile(t);
  const env = {};
  const outer = await takeHeavyLock('push-suite', { file, wait: false, env });
  const inner = await takeHeavyLock('spec:stress', { file, wait: false, env });
  assert.equal(inner.ok, true);
  assert.equal(readHolder(file).name, 'push-suite');
  outer.release();
});

test('a lock taker under node --test without a private lock file fails instead of taking the real lock', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'heavy-run-lock-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, TMPDIR: dir, NODE_TEST_CONTEXT: 'child-v8' };
  delete env['ETHLETE_HEAVY_LOCK_FILE'];
  delete env['ETHLETE_HEAVY_RUN_HELD'];
  const script = `
    const { takeHeavyLock } = await import(${JSON.stringify(new URL('./heavy-run-lock.mjs', import.meta.url).href)});
    const lock = await takeHeavyLock('bite', { wait: false });
    console.log(lock.ok ? 'took' : 'refused');`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env, encoding: 'utf8' });
  assert.equal(run.stdout, '');
  assert.match(
    run.stderr,
    /heavy-run-lock: a test takes the real lock; pass the file option or env ETHLETE_HEAVY_LOCK_FILE/,
  );
  assert.deepEqual(readdirSync(dir), []);
});
