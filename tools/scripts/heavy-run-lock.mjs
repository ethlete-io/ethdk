import { execFileSync } from 'node:child_process';
import { closeSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LOCK_NAME = 'ethlete-heavy-run.lock';
const FILE_ENV = 'ETHLETE_HEAVY_LOCK_FILE';
export const HEAVY_LOCK_FILE = join(tmpdir(), LOCK_NAME);
export const HEAVY_LOCK_POLL_MS = 10_000;
export const HEAVY_LOCK_MAX_WAIT_MS = 60 * 60_000;
const HELD_ENV = 'ETHLETE_HEAVY_RUN_HELD';

// The Nx daemon runs without the caller's TMPDIR (Nx does not forward it), so on macOS its os.tmpdir() is /tmp while
// push:suite writes the lock into the per-user temp dir.
/**
 * Resolves the machine's heavy-run lock file. Env `ETHLETE_HEAVY_LOCK_FILE` wins: specs and live checks set it to a
 * private file so they never touch the real lock.
 */
export const lockFileOf = (env = process.env, platform = process.platform) => {
  if (env[FILE_ENV]) return env[FILE_ENV];
  if (env['TMPDIR'] || platform !== 'darwin') return HEAVY_LOCK_FILE;
  try {
    return join(execFileSync('getconf', ['DARWIN_USER_TEMP_DIR'], { encoding: 'utf8' }).trim(), LOCK_NAME);
  } catch {
    return HEAVY_LOCK_FILE;
  }
};

const takenLockFileOf = (env) => {
  if (process.env['NODE_TEST_CONTEXT'] && !env[FILE_ENV])
    throw new Error(`heavy-run-lock: a test takes the real lock; pass the file option or env ${FILE_ENV}`);
  return lockFileOf(env);
};

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

export const readHolder = (file = lockFileOf()) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};

export const holderLine = (holder) =>
  `heavy run lock held by ${holder.name} (pid ${holder.pid}, since ${new Date(holder.started).toISOString()})`;

const tryTake = (file, name, now) => {
  try {
    const fd = openSync(file, 'wx');
    writeSync(fd, JSON.stringify({ pid: process.pid, name, started: now }));
    closeSync(fd);
    return { ok: true };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const holder = readHolder(file);
  if (holder && isAlive(holder.pid)) return { ok: false, holder };
  rmSync(file, { force: true });
  return tryTake(file, name, now);
};

/**
 * Takes the one heavy-run lock of this machine for `name` (push:suite, spec:stress). A held lock of a live process
 * makes the caller wait up to `maxWaitMs`, or stop at once with `wait: false`; a dead holder's lock is taken over.
 * Returns `{ ok, release }` or `{ ok: false, holder }`. A child of a holder (env `ETHLETE_HEAVY_RUN_HELD`) takes none;
 * the holder sets `NX_DAEMON=false` too, since the Nx daemon cannot pass that env to the wait hook.
 */
export const takeHeavyLock = async (
  name,
  {
    file: fileOption,
    wait = true,
    maxWaitMs = HEAVY_LOCK_MAX_WAIT_MS,
    pollMs = HEAVY_LOCK_POLL_MS,
    log = console.error,
    env = process.env,
    now = Date.now,
    sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  } = {},
) => {
  if (env[HELD_ENV]) return { ok: true, release: () => undefined };
  const file = fileOption ?? takenLockFileOf(env);
  const startedAt = now();
  let logged;
  for (;;) {
    const taken = tryTake(file, name, now());
    if (taken.ok) {
      const daemon = env['NX_DAEMON'];
      env[HELD_ENV] = String(process.pid);
      env['NX_DAEMON'] = 'false';
      const release = () => {
        if (readHolder(file)?.pid === process.pid) rmSync(file, { force: true });
        delete env[HELD_ENV];
        if (daemon === undefined) delete env['NX_DAEMON'];
        else env['NX_DAEMON'] = daemon;
      };
      process.once('exit', release);
      return { ok: true, release };
    }
    if (!wait || now() - startedAt >= maxWaitMs) return { ok: false, holder: taken.holder };
    if (logged !== taken.holder.pid) {
      log(`${name}: ${holderLine(taken.holder)}; waiting`);
      logged = taken.holder.pid;
    }
    await sleep(pollMs);
  }
};

/**
 * Waits while another process holds the heavy-run lock, without taking it: slice tests and builds yield to a running
 * push:suite or studio:e2e. Returns `{ ok: true }` once the lock is free or its holder is dead, `{ ok: false, holder }`
 * with `wait: false` or after `maxWaitMs`. A child of a holder (env `ETHLETE_HEAVY_RUN_HELD`) never waits.
 */
export const waitForNoHeavyRun = async (
  name,
  {
    file: fileOption,
    wait = true,
    maxWaitMs = HEAVY_LOCK_MAX_WAIT_MS,
    pollMs = HEAVY_LOCK_POLL_MS,
    log = console.error,
    env = process.env,
    now = Date.now,
    sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  } = {},
) => {
  if (env[HELD_ENV]) return { ok: true };
  const file = fileOption ?? lockFileOf(env);
  const startedAt = now();
  let logged;
  for (;;) {
    const holder = readHolder(file);
    if (!holder || !isAlive(holder.pid)) return { ok: true };
    if (!wait || now() - startedAt >= maxWaitMs) return { ok: false, holder };
    if (logged !== holder.pid) {
      log(`${name}: waiting for ${holder.name} (pid ${holder.pid}, since ${new Date(holder.started).toISOString()})`);
      logged = holder.pid;
    }
    await sleep(pollMs);
  }
};
