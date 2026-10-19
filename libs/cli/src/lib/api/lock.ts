import { randomUUID } from 'crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { hostname } from 'os';
import { join } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { markApiStateDirty } from './api-state';

/** Who holds an API's lock. `token` is handed to the holder's command as `ETHLETE_API_LOCK`. */
export type ApiLock = {
  pid: number;
  hostname: string;
  command: string;
  cwd: string;
  startedAt: string;
  token: string;
};

export const API_LOCK_ENV = 'ETHLETE_API_LOCK';

export type LockSystem = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  kill: (pid: number, signal: 0) => void;
  hostname: () => string;
  pid: number;
};

const realSystem = (): LockSystem => ({
  now: () => Date.now(),
  sleep: async (ms) => void (await delay(ms)),
  kill: (pid, signal) => void process.kill(pid, signal),
  hostname,
  pid: process.pid,
});

const POLL_MS = 1000;

export const lockPath = (directory: string) => join(directory, 'lock.json');

/** The current lock, or `undefined` when there is none or it cannot be read. */
export const readApiLock = (directory: string): ApiLock | undefined => {
  try {
    const value = JSON.parse(readFileSync(lockPath(directory), 'utf8')) as Partial<ApiLock>;

    return typeof value.token === 'string' && typeof value.pid === 'number' ? (value as ApiLock) : undefined;
  } catch {
    return undefined;
  }
};

/** One line naming the holder, for the wait and timeout messages. */
export const describeApiLock = (lock: ApiLock | undefined, directory: string) =>
  lock
    ? `pid ${lock.pid} on ${lock.hostname} since ${lock.startedAt}: ${lock.command} (in ${lock.cwd})`
    : `an unreadable ${lockPath(directory)}`;

const isAlive = (system: LockSystem, pid: number) => {
  try {
    system.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};

const isStale = (system: LockSystem, lock: ApiLock) =>
  lock.hostname === system.hostname() && !isAlive(system, lock.pid);

const tryCreate = (directory: string, lock: ApiLock) => {
  try {
    writeFileSync(lockPath(directory), `${JSON.stringify(lock, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;

    throw error;
  }
};

export type AcquireApiLockResult = { ok: true; lock: ApiLock } | { ok: false; holder: ApiLock | undefined };

/**
 * Takes the lock in `directory`. A lock whose pid is dead on this host is taken over, and the state
 * becomes dirty. Otherwise it polls every second for up to `wait` seconds, or without end when `wait`
 * is `undefined`, and calls `onHeld` once with the holder.
 */
export const acquireApiLock = async (options: {
  directory: string;
  command: string;
  cwd: string;
  wait?: number;
  onHeld?: (holder: ApiLock | undefined) => void;
  system?: LockSystem;
}): Promise<AcquireApiLockResult> => {
  const { directory, command, cwd, wait, onHeld, system = realSystem() } = options;
  const startedAt = system.now();
  let announced = false;

  mkdirSync(directory, { recursive: true });

  for (;;) {
    const lock: ApiLock = {
      pid: system.pid,
      hostname: system.hostname(),
      command,
      cwd,
      startedAt: new Date(system.now()).toISOString(),
      token: randomUUID(),
    };

    if (tryCreate(directory, lock)) return { ok: true, lock };

    const holder = readApiLock(directory);

    if (holder && isStale(system, holder)) {
      if (readApiLock(directory)?.token === holder.token) {
        rmSync(lockPath(directory), { force: true });
        markApiStateDirty(directory, new Date(system.now()));
      }

      continue;
    }

    if (!announced) {
      announced = true;
      onHeld?.(holder);
    }

    if (wait !== undefined && system.now() - startedAt >= wait * 1000) return { ok: false, holder };

    await system.sleep(POLL_MS);
  }
};

/** Removes the lock only while it is still the one `token` names. */
export const releaseApiLock = (directory: string, token: string) => {
  if (readApiLock(directory)?.token !== token) return false;

  rmSync(lockPath(directory), { force: true });

  return true;
};

/** The current lock when `ETHLETE_API_LOCK` names it, so a command run under the lock does not wait for it. */
export const heldLockFromEnv = (directory: string, env: NodeJS.ProcessEnv = process.env) => {
  const token = env[API_LOCK_ENV];
  const lock = readApiLock(directory);

  return token && lock?.token === token ? lock : undefined;
};
