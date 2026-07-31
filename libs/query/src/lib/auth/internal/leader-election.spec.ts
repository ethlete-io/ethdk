import { TestBed } from '@angular/core/testing';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupLeaderElection } from './leader-election';

/**
 * Lets lock grants, presence messages and the `navigator.locks.query()` behind the instance count all
 * land — each is a microtask hop, and a recount triggered by a message is two.
 */
const settle = async () => {
  for (let i = 0; i < 5; i++) {
    TestBed.tick();
    await flushMultiTabSync();
  }
};

const openTab = () => TestBed.runInInjectionContext(() => setupLeaderElection());

describe('setupLeaderElection', () => {
  let bus: FakeBroadcastChannelHandle;
  let locks: FakeWebLocksHandle;

  beforeEach(() => {
    bus = installFakeBroadcastChannel();
    locks = installFakeWebLocks();
  });

  afterEach(() => {
    bus.restore();
    locks.restore();
  });

  it('should make the only tab the leader', async () => {
    const tab = openTab();

    expect(tab.isLeader()).toBe(false);

    await settle();

    expect(tab.isLeader()).toBe(true);
    expect(tab.instanceCount()).toBe(1);

    tab.cleanup();
  });

  it('should hold one namespaced lock', async () => {
    const tab = openTab();

    await settle();

    expect(locks.heldNames()).toEqual(['ethlete-auth:leader']);

    tab.cleanup();
  });

  it('should leave a second tab queued behind the first', async () => {
    const first = openTab();
    const second = openTab();

    await settle();

    expect(first.isLeader()).toBe(true);
    expect(second.isLeader()).toBe(false);
    expect(locks.pendingNames()).toEqual(['ethlete-auth:leader']);

    first.cleanup();
    second.cleanup();
  });

  it('should hand leadership to the waiting tab when the leader goes away', async () => {
    const first = openTab();
    const second = openTab();

    await settle();

    first.cleanup();
    await settle();

    expect(second.isLeader()).toBe(true);

    second.cleanup();
  });

  it('should count every tab taking part', async () => {
    const first = openTab();

    await settle();

    expect(first.instanceCount()).toBe(1);

    const second = openTab();

    await settle();

    expect(first.instanceCount()).toBe(2);
    expect(second.instanceCount()).toBe(2);

    const third = openTab();

    await settle();

    expect(first.instanceCount()).toBe(3);

    third.cleanup();
    await settle();

    expect(first.instanceCount()).toBe(2);
    expect(second.instanceCount()).toBe(2);

    first.cleanup();
    second.cleanup();
  });

  it('should release the lock on cleanup, idempotently', async () => {
    const tab = openTab();

    await settle();

    tab.cleanup();

    expect(() => tab.cleanup()).not.toThrow();

    await settle();

    expect(locks.heldNames()).toEqual([]);
  });

  it('should expose read-only signals', async () => {
    const tab = openTab();

    await settle();

    expect((tab.isLeader as unknown as Record<string, unknown>)['set']).toBeUndefined();
    expect((tab.instanceCount as unknown as Record<string, unknown>)['set']).toBeUndefined();

    tab.cleanup();
  });

  it('should make the tab the leader without Web Locks', () => {
    locks.restore();

    const tab = openTab();

    expect(tab.isLeader()).toBe(true);
    expect(tab.instanceCount()).toBe(1);
    expect(() => tab.cleanup()).not.toThrow();

    locks = installFakeWebLocks();
  });

  it('should elect without a BroadcastChannel, only losing the instance count', async () => {
    bus.restore();

    const first = openTab();
    const second = openTab();

    await settle();

    expect(first.isLeader()).toBe(true);
    expect(second.isLeader()).toBe(false);

    first.cleanup();
    second.cleanup();

    bus = installFakeBroadcastChannel();
  });
});
