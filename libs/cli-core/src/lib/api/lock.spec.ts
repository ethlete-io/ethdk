import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readApiState } from './api-state';
import { ApiLock, LockSystem, acquireApiLock, heldLockFromEnv, lockPath, readApiLock, releaseApiLock } from './lock';

const fakeSystem = (options: { dead?: number[]; pid?: number } = {}) => {
  const { dead = [], pid = 100 } = options;
  let clock = Date.parse('2026-10-19T10:00:00.000Z');
  const sleeps: number[] = [];
  const system: LockSystem = {
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    kill: (target) => {
      if (dead.includes(target)) throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
    },
    hostname: () => 'box',
    pid,
  };

  return { system, sleeps };
};

const directory = () => join(mkdtempSync(join(tmpdir(), 'cli-api-lock-')), 'hub');

const plant = (path: string, lock: Partial<ApiLock>) => {
  const planted: ApiLock = {
    pid: 7,
    hostname: 'box',
    command: 'playwright test',
    cwd: '/repo',
    startedAt: '2026-10-19T09:00:00.000Z',
    token: 'held',
    ...lock,
  };

  mkdirSync(path, { recursive: true });
  writeFileSync(lockPath(path), JSON.stringify(planted), 'utf8');

  return planted;
};

describe('acquireApiLock', () => {
  it('takes a free lock and records who holds it', async () => {
    const path = directory();
    const { system } = fakeSystem();
    const result = await acquireApiLock({ directory: path, command: 'yarn e2e', cwd: '/repo', system });

    expect(result.ok).toBe(true);
    expect(readApiLock(path)).toMatchObject({ pid: 100, hostname: 'box', command: 'yarn e2e', cwd: '/repo' });
    expect(readApiLock(path)?.token).toBe(result.ok ? result.lock.token : undefined);
  });

  it('waits for a live holder, names it once, and gives up after --wait', async () => {
    const path = directory();
    const holder = plant(path, {});
    const { system, sleeps } = fakeSystem();
    const held: (ApiLock | undefined)[] = [];
    const result = await acquireApiLock({
      directory: path,
      command: 'yarn e2e',
      cwd: '/repo',
      wait: 3,
      system,
      onHeld: (lock) => held.push(lock),
    });

    expect(result).toEqual({ ok: false, holder });
    expect(held).toEqual([holder]);
    expect(sleeps).toEqual([1000, 1000, 1000]);
    expect(readApiLock(path)).toEqual(holder);
  });

  it('takes the lock once the holder releases it', async () => {
    const path = directory();

    plant(path, {});

    const { system } = fakeSystem();
    const sleep = system.sleep;

    system.sleep = async (ms) => {
      await sleep(ms);
      releaseApiLock(path, 'held');
    };

    const result = await acquireApiLock({ directory: path, command: 'yarn e2e', cwd: '/repo', system });

    expect(result.ok).toBe(true);
  });

  it('takes over the lock of a dead pid on this host and marks the state dirty', async () => {
    const path = directory();

    plant(path, { pid: 7 });

    const { system, sleeps } = fakeSystem({ dead: [7] });
    const result = await acquireApiLock({ directory: path, command: 'yarn e2e', cwd: '/repo', wait: 0, system });

    expect(result.ok).toBe(true);
    expect(sleeps).toEqual([]);
    expect(readApiLock(path)?.pid).toBe(100);
    expect(readApiState(path)?.dirty).toBe(true);
  });

  it('leaves a live lock alone that a faster waiter created after the stale one was read', async () => {
    const path = directory();

    plant(path, { pid: 7 });

    const { system } = fakeSystem({ dead: [7] });
    const kill = system.kill;

    system.kill = (pid, signal) => {
      if (pid === 7) plant(path, { pid: 8, token: 'faster' });

      kill(pid, signal);
    };

    const result = await acquireApiLock({ directory: path, command: 'x', cwd: '/repo', wait: 0, system });

    expect(result.ok).toBe(false);
    expect(readApiLock(path)?.token).toBe('faster');
    expect(readApiState(path)).toBeUndefined();
    expect(readdirSync(path)).toEqual(['lock.json']);
  });

  it('goes back to the lock when another waiter already claimed the stale one', async () => {
    const path = directory();

    plant(path, { pid: 7 });

    const { system } = fakeSystem({ dead: [7] });
    const kill = system.kill;

    system.kill = (pid, signal) => {
      if (pid === 7) rmSync(lockPath(path));

      kill(pid, signal);
    };

    const result = await acquireApiLock({ directory: path, command: 'x', cwd: '/repo', wait: 0, system });

    expect(result.ok).toBe(true);
    expect(readdirSync(path)).toEqual(['lock.json']);
  });

  it('does not judge a pid on another host', async () => {
    const path = directory();

    plant(path, { pid: 7, hostname: 'other' });

    const { system } = fakeSystem({ dead: [7] });
    const result = await acquireApiLock({ directory: path, command: 'yarn e2e', cwd: '/repo', wait: 0, system });

    expect(result.ok).toBe(false);
  });

  it('treats a pid it may not signal as alive', async () => {
    const path = directory();

    plant(path, { pid: 1 });

    const { system } = fakeSystem();

    system.kill = () => {
      throw Object.assign(new Error('not permitted'), { code: 'EPERM' });
    };

    expect((await acquireApiLock({ directory: path, command: 'x', cwd: '/repo', wait: 0, system })).ok).toBe(false);
  });
});

describe('releaseApiLock', () => {
  it('removes only the lock its token names', () => {
    const path = directory();

    plant(path, { token: 'held' });

    expect(releaseApiLock(path, 'other')).toBe(false);
    expect(readApiLock(path)).toBeDefined();
    expect(releaseApiLock(path, 'held')).toBe(true);
    expect(readApiLock(path)).toBeUndefined();
  });
});

describe('heldLockFromEnv', () => {
  it('returns the lock ETHLETE_API_LOCK names', () => {
    const path = directory();
    const lock = plant(path, { token: 'held' });

    expect(heldLockFromEnv(path, { ETHLETE_API_LOCK: 'held' })).toEqual(lock);
    expect(heldLockFromEnv(path, { ETHLETE_API_LOCK: 'old' })).toBeUndefined();
    expect(heldLockFromEnv(path, {})).toBeUndefined();
  });
});
