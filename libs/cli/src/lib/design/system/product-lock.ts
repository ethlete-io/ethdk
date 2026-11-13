import {
  closeSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'fs';
import { basename, dirname, resolve } from 'path';
import { writeChangedFile } from '../../json-file';
import { productCacheDirOf } from './product';

const LOCK_FILE = 'decisions.lock';
const WAIT_MS = 10_000;
const UNWRITTEN_GRACE_MS = 5_000;

const heldLocks = new Map<string, number>();
const sleeper = new Int32Array(new SharedArrayBuffer(4));

const sleepSync = (ms: number) => Atomics.wait(sleeper, 0, 0, ms);

const lockFileOf = (productDir: string) => resolve(productCacheDirOf(resolve(productDir)), LOCK_FILE);

const holderPidOf = (lockFile: string): number | null | 'gone' => {
  try {
    const pid = Number.parseInt(readFileSync(lockFile, 'utf8'), 10);

    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return 'gone';
  }
};

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const isStale = (lockFile: string, pid: number | null) => {
  if (pid !== null) return !isAlive(pid);

  try {
    return Date.now() - statSync(lockFile).mtimeMs > UNWRITTEN_GRACE_MS;
  } catch {
    return false;
  }
};

const tryCreate = (lockFile: string) => {
  try {
    const fd = openSync(lockFile, 'wx');

    try {
      writeSync(fd, `${process.pid}\n`);
    } finally {
      closeSync(fd);
    }

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;

    throw error;
  }
};

const takeOver = (lockFile: string, stalePid: number | null) => {
  const moved = `${lockFile}.${process.pid}.stale`;

  try {
    renameSync(lockFile, moved);
  } catch {
    return;
  }

  // The rename can catch a fresh lock that another process created after this one read the stale pid: put it back.
  if (holderPidOf(moved) !== stalePid) {
    try {
      linkSync(moved, lockFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }

  unlinkSync(moved);
};

const acquire = (productDir: string, waitMs: number) => {
  const lockFile = lockFileOf(productDir);
  const deadline = Date.now() + waitMs;

  mkdirSync(dirname(lockFile), { recursive: true });

  for (;;) {
    if (tryCreate(lockFile)) return lockFile;

    const pid = holderPidOf(lockFile);

    if (pid === 'gone') continue;
    if (isStale(lockFile, pid)) {
      takeOver(lockFile, pid);
      continue;
    }

    if (Date.now() >= deadline)
      throw new Error(
        `the design files of ${productDir} are locked by ${pid === null ? 'a process that has not written its pid' : `pid ${pid}`} (${lockFile}) - wait for it to finish, or stop it`,
      );

    sleepSync(10 + Math.floor(Math.random() * 15));
  }
};

/**
 * Runs `run` while this process holds the write lock of a product's `ready.json`, `merged.json` and `sketch.json`
 * files, so a read-modify-write of them cannot interleave with another process. Re-entrant within one process; waits
 * up to `waitMs` (10 s) for another holder, takes over the lock of a dead pid, and throws naming the holder otherwise.
 */
export const withProductLock = <T>(product: string | { dir: string; waitMs?: number }, run: () => T): T => {
  const { dir, waitMs = WAIT_MS } = typeof product === 'string' ? { dir: product } : product;
  const key = resolve(dir);
  const depth = heldLocks.get(key) ?? 0;
  const lockFile = depth === 0 ? acquire(key, waitMs) : null;

  heldLocks.set(key, depth + 1);

  try {
    return run();
  } finally {
    if (depth === 0) {
      heldLocks.delete(key);
      if (lockFile) unlinkSync(lockFile);
    } else heldLocks.set(key, depth);
  }
};

const productDirOfSketch = (sketchDir: string) => resolve(sketchDir, '..', '..');

/**
 * Writes a product's `ready.json`, `merged.json` or a sketch's `sketch.json` atomically under the product lock; any
 * other file is written atomically without it.
 */
export const writeDecisionFile = (file: string, text: string) => {
  const name = basename(file);

  if (name === 'sketch.json') withProductLock(productDirOfSketch(dirname(file)), () => writeChangedFile(file, text));
  else if (name === 'ready.json' || name === 'merged.json')
    withProductLock(dirname(file), () => writeChangedFile(file, text));
  else writeChangedFile(file, text);
};
