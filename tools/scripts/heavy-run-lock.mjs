import { closeSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const HEAVY_LOCK_FILE = join(tmpdir(), 'ethlete-heavy-run.lock');
export const HEAVY_LOCK_POLL_MS = 10_000;
export const HEAVY_LOCK_MAX_WAIT_MS = 60 * 60_000;
const HELD_ENV = 'ETHLETE_HEAVY_RUN_HELD';

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

export const readHolder = (file = HEAVY_LOCK_FILE) => {
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
 * Returns `{ ok, release }` or `{ ok: false, holder }`. A child of a holder (env `ETHLETE_HEAVY_RUN_HELD`) takes none.
 */
export const takeHeavyLock = async (
  name,
  {
    file = HEAVY_LOCK_FILE,
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
  const startedAt = now();
  let logged;
  for (;;) {
    const taken = tryTake(file, name, now());
    if (taken.ok) {
      env[HELD_ENV] = String(process.pid);
      const release = () => {
        if (readHolder(file)?.pid === process.pid) rmSync(file, { force: true });
        delete env[HELD_ENV];
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
