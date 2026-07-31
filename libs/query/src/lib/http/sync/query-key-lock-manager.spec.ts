import { FakeWebLocksHandle, flushMultiTabSync, installFakeWebLocks } from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryKeyLockManager } from './query-key-lock-manager';

describe('createQueryKeyLockManager', () => {
  let locks: FakeWebLocksHandle;

  beforeEach(() => {
    locks = installFakeWebLocks();
  });

  afterEach(() => {
    locks.restore();
  });

  it('should grant the lock asynchronously', async () => {
    const manager = createQueryKeyLockManager('test');
    const hold = manager.hold('key');

    expect(manager.isSupported).toBe(true);
    expect(hold.isHolder()).toBe(false);

    await flushMultiTabSync();

    expect(hold.isHolder()).toBe(true);

    hold.release();
  });

  it('should namespace the lock name', async () => {
    const manager = createQueryKeyLockManager('et-query-poll:api');
    const hold = manager.hold('42');

    await flushMultiTabSync();

    expect(locks.heldNames()).toEqual(['et-query-poll:api:42']);

    hold.release();
  });

  it('should grant only one holder per key and hand over on release', async () => {
    const tabA = createQueryKeyLockManager('test');
    const tabB = createQueryKeyLockManager('test');

    const holdA = tabA.hold('key');
    const holdB = tabB.hold('key');

    await flushMultiTabSync();

    expect(holdA.isHolder()).toBe(true);
    expect(holdB.isHolder()).toBe(false);
    expect(locks.pendingNames()).toEqual(['test:key']);

    holdA.release();
    await flushMultiTabSync();

    expect(holdA.isHolder()).toBe(false);
    expect(holdB.isHolder()).toBe(true);

    holdB.release();
  });

  it('should let two different keys be held at once', async () => {
    const manager = createQueryKeyLockManager('test');

    const first = manager.hold('a');
    const second = manager.hold('b');

    await flushMultiTabSync();

    expect(first.isHolder()).toBe(true);
    expect(second.isHolder()).toBe(true);

    first.release();
    second.release();
  });

  it('should cancel a request that is still queued', async () => {
    const tabA = createQueryKeyLockManager('test');
    const tabB = createQueryKeyLockManager('test');

    const holdA = tabA.hold('key');
    const holdB = tabB.hold('key');

    await flushMultiTabSync();

    holdB.release();
    await flushMultiTabSync();

    expect(locks.pendingNames()).toEqual([]);
    expect(holdB.isHolder()).toBe(false);
    expect(holdA.isHolder()).toBe(true);

    holdA.release();
  });

  it('should give the lock straight back when released before the grant lands', async () => {
    const tabA = createQueryKeyLockManager('test');
    const tabB = createQueryKeyLockManager('test');

    const holdA = tabA.hold('key');

    holdA.release();

    const holdB = tabB.hold('key');

    await flushMultiTabSync();
    await flushMultiTabSync();
    await flushMultiTabSync();

    expect(holdA.isHolder()).toBe(false);
    expect(holdB.isHolder()).toBe(true);

    holdB.release();
  });

  it('should be idempotent on release', async () => {
    const manager = createQueryKeyLockManager('test');
    const hold = manager.hold('key');

    await flushMultiTabSync();

    hold.release();

    expect(() => hold.release()).not.toThrow();

    await flushMultiTabSync();

    expect(locks.heldNames()).toEqual([]);
  });

  it('should re-request behind a waiting tab, which is how a hidden holder hands over', async () => {
    const visible = createQueryKeyLockManager('test');
    const hidden = createQueryKeyLockManager('test');

    let hiddenHold = hidden.hold('key');
    const visibleHold = visible.hold('key');

    await flushMultiTabSync();

    expect(hiddenHold.isHolder()).toBe(true);

    // What `withPolling` does when its tab becomes hidden: release, then immediately ask again — FIFO
    // puts it behind the tab that was already waiting.
    hiddenHold.release();
    hiddenHold = hidden.hold('key');

    await flushMultiTabSync();
    await flushMultiTabSync();

    expect(visibleHold.isHolder()).toBe(true);
    expect(hiddenHold.isHolder()).toBe(false);

    visibleHold.release();
    hiddenHold.release();
  });

  it('should report where each tab stands, for the devtools', async () => {
    const tabA = createQueryKeyLockManager('test');
    const tabB = createQueryKeyLockManager('test');

    const holdA = tabA.hold('key');
    const holdB = tabB.hold('key');

    expect(tabA.keyStates()).toEqual({ key: 'standby' });

    await flushMultiTabSync();

    expect(tabA.keyStates()).toEqual({ key: 'holder' });
    expect(tabB.keyStates()).toEqual({ key: 'standby' });

    holdA.release();
    await flushMultiTabSync();

    expect(tabA.keyStates()).toEqual({});
    expect(tabB.keyStates()).toEqual({ key: 'holder' });

    holdB.release();

    expect(tabB.keyStates()).toEqual({});
  });

  it('should make every caller a holder without Web Locks', () => {
    locks.restore();

    const manager = createQueryKeyLockManager('test');
    const first = manager.hold('key');
    const second = manager.hold('key');

    expect(manager.isSupported).toBe(false);
    expect(first.isHolder()).toBe(true);
    expect(second.isHolder()).toBe(true);
    expect(() => first.release()).not.toThrow();
  });
});
