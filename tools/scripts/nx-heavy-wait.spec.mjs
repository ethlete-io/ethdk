import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { HEAVY_LOCK_FILE, lockFileOf } from './heavy-run-lock.mjs';
import { heavyWaitBeforeTasks } from './nx-heavy-wait.mjs';

const plugin = new URL('./nx-heavy-wait.mjs', import.meta.url).href;
const lockModule = new URL('./heavy-run-lock.mjs', import.meta.url).href;

const lockFile = (t, holder) => {
  const dir = mkdtempSync(join(tmpdir(), 'nx-heavy-wait-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'ethlete-heavy-run.lock');
  if (holder) writeFileSync(file, JSON.stringify({ name: 'push-suite', started: Date.now(), ...holder }));
  return file;
};

const deadPid = () =>
  Number(spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' }).stdout);

const quiet = { log: () => undefined, maxWaitMs: 2000, sleep: () => new Promise((done) => setTimeout(done, 20)) };

test('a live holder makes the hook wait until it ends', { timeout: 15_000 }, async (t) => {
  const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 600)']);
  const file = lockFile(t, { pid: holder.pid });
  const lines = [];
  const startedAt = Date.now();
  const free = await heavyWaitBeforeTasks({ env: {}, file, ...quiet, log: (line) => lines.push(line) });
  assert.equal(free.ok, true);
  assert.ok(Date.now() - startedAt >= 400, 'the hook returned only after the holder ended');
  assert.deepEqual(lines, [lines[0]]);
  assert.match(lines[0], new RegExp(`^nx: waiting for push-suite \\(pid ${holder.pid}, since .+\\)$`));
});

test('ETHLETE_HEAVY_NO_WAIT makes the hook refuse a live holder at once', { timeout: 15_000 }, async (t) => {
  const file = lockFile(t, { pid: process.pid });
  const free = await heavyWaitBeforeTasks({ env: { ETHLETE_HEAVY_NO_WAIT: '1' }, file, ...quiet });
  assert.equal(free.ok, false);
  assert.equal(free.holder.pid, process.pid);
});

test('a dead holder, a held env or an exempt design build proceed at once', { timeout: 15_000 }, async (t) => {
  const dead = lockFile(t, { pid: deadPid() });
  assert.equal((await heavyWaitBeforeTasks({ env: { ETHLETE_HEAVY_NO_WAIT: '1' }, file: dead, ...quiet })).ok, true);
  const live = lockFile(t, { pid: process.pid });
  for (const env of [{ ETHLETE_HEAVY_RUN_HELD: String(process.pid) }, { ETHLETE_HEAVY_EXEMPT: 'design' }]) {
    assert.equal(
      (await heavyWaitBeforeTasks({ env: { ETHLETE_HEAVY_NO_WAIT: '1', ...env }, file: live, ...quiet })).ok,
      true,
    );
  }
});

test(
  'the nx hook rejects with the one-line refusal, and returns silently without a lock',
  { timeout: 15_000 },
  async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'nx-heavy-wait-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const env = {
      ...process.env,
      ETHLETE_HEAVY_LOCK_FILE: join(dir, 'ethlete-heavy-run.lock'),
      ETHLETE_HEAVY_NO_WAIT: '1',
      ETHLETE_HEAVY_MAX_WAIT_MS: '2000',
      ETHLETE_HEAVY_POLL_MS: '100',
    };
    delete env['ETHLETE_HEAVY_RUN_HELD'];
    delete env['ETHLETE_HEAVY_EXEMPT'];
    const hook = `import(${JSON.stringify(plugin)}).then((m) => m.preTasksExecution()).then(() => console.log('ran'), (error) => { console.error(error.message); process.exit(2); })`;
    const run = () => spawnSync(process.execPath, ['-e', hook], { env, encoding: 'utf8', timeout: 10_000 });
    const free = run();
    assert.equal(free.status, 0, free.stderr);
    assert.equal(free.stdout, 'ran\n');
    assert.equal(free.stderr, '');
    writeFileSync(
      join(dir, 'ethlete-heavy-run.lock'),
      JSON.stringify({ name: 'push-suite', pid: process.pid, started: 0 }),
    );
    const refused = run();
    assert.equal(refused.status, 2);
    assert.equal(refused.stdout, '');
    assert.match(
      refused.stderr,
      /^nx: heavy run lock held by push-suite \(pid \d+, since .+\); run again after it ends\n$/,
    );
  },
);

test("under the Nx daemon, which drops TMPDIR, the hook still reads the callers' lock file on macOS", () => {
  assert.equal(lockFileOf({ TMPDIR: '/x' }, 'darwin'), HEAVY_LOCK_FILE);
  assert.equal(lockFileOf({}, 'linux'), HEAVY_LOCK_FILE);
  assert.equal(lockFileOf({ ETHLETE_HEAVY_LOCK_FILE: '/x/own.lock' }, 'darwin'), '/x/own.lock');
  if (process.platform !== 'darwin') return;
  const userTemp = spawnSync('getconf', ['DARWIN_USER_TEMP_DIR'], { encoding: 'utf8' }).stdout.trim();
  const env = { ...process.env };
  delete env['TMPDIR'];
  delete env['ETHLETE_HEAVY_LOCK_FILE'];
  const daemonLike = spawnSync(
    process.execPath,
    ['-e', `import(${JSON.stringify(lockModule)}).then((m) => console.log(m.lockFileOf()))`],
    { env, encoding: 'utf8', timeout: 10_000 },
  );
  assert.equal(daemonLike.stdout.trim(), join(userTemp, 'ethlete-heavy-run.lock'));
});

test(
  "under the Nx daemon, whose worker holds the last client's env, an exempt or held flag never skips the wait",
  { timeout: 20_000 },
  async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'nx-heavy-wait-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const lock = join(dir, 'ethlete-heavy-run.lock');
    writeFileSync(lock, JSON.stringify({ name: 'push-suite', pid: process.pid, started: 0 }));
    const hook = `import(${JSON.stringify(plugin)}).then((m) => m.preTasksExecution()).then(() => console.log('ran'), (error) => { console.error(error.message); process.exit(2); })`;
    const daemon = join(dir, 'nx/dist/src/daemon/server/start.js');
    mkdirSync(join(dir, 'nx/dist/src/daemon/server'), { recursive: true });
    writeFileSync(
      daemon,
      `const r = require('node:child_process').spawnSync(process.execPath, ['-e', ${JSON.stringify(hook)}], { encoding: 'utf8' });
process.stdout.write(r.stdout); process.stderr.write(r.stderr); process.exit(r.status);`,
    );
    const base = { ...process.env, ETHLETE_HEAVY_LOCK_FILE: lock, ETHLETE_HEAVY_NO_WAIT: '1' };
    delete base['ETHLETE_HEAVY_RUN_HELD'];
    delete base['ETHLETE_HEAVY_EXEMPT'];
    for (const flag of [{ ETHLETE_HEAVY_EXEMPT: 'design' }, { ETHLETE_HEAVY_RUN_HELD: '1' }]) {
      const env = { ...base, ...flag };
      const daemonless = spawnSync(process.execPath, ['-e', hook], { env, encoding: 'utf8', timeout: 10_000 });
      assert.equal(daemonless.stdout, 'ran\n', daemonless.stderr);
      const onDaemon = spawnSync(process.execPath, [daemon], { env, encoding: 'utf8', timeout: 10_000 });
      assert.equal(onDaemon.status, 2, onDaemon.stdout);
      assert.match(onDaemon.stderr, /^nx: heavy run lock held by push-suite .+, or with NX_DAEMON=false\n$/);
    }
  },
);
