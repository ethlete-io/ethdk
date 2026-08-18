import { TestBed } from '@angular/core/testing';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InternalLeaderElection, setupLeaderElection } from './leader-election';

/**
 * Lets lock grants, presence messages and the `navigator.locks.query()` behind the instance count all
 * land - each is a microtask hop, and a recount triggered by a message is two.
 */
const settle = async () => {
  for (let i = 0; i < 5; i++) {
    TestBed.tick();
    await flushMultiTabSync();
  }
};

const opened: InternalLeaderElection[] = [];

const openTab = (name = 'test-auth') => {
  const tab = TestBed.runInInjectionContext(() => setupLeaderElection({ name }));

  opened.push(tab);

  return tab;
};

/**
 * A tab that is not an election instance, so it hears none of the page lifecycle events the specs
 * dispatch on the one shared `document` - which is the only way to tell two tabs apart in here.
 */
const openForeignTab = (name = 'test-auth') => {
  let isLeader = false;
  let release = () => {
    /* not granted yet */
  };

  const done = navigator.locks.request(`ethlete-auth:leader:${name}`, () => {
    isLeader = true;

    return new Promise<void>((resolve) => {
      release = () => {
        isLeader = false;
        resolve();
      };
    });
  });

  return {
    isLeader: () => isLeader,
    close: async () => {
      release();
      await done.catch(() => undefined);
    },
  };
};

describe('setupLeaderElection', () => {
  let bus: FakeBroadcastChannelHandle;
  let locks: FakeWebLocksHandle;

  beforeEach(() => {
    bus = installFakeBroadcastChannel();
    locks = installFakeWebLocks();
  });

  afterEach(() => {
    // Every tab, not only the ones a passing spec cleans up: a leaked tab keeps its page lifecycle
    // listeners on the shared `document` and reacts to the next spec's events.
    for (const tab of opened.splice(0)) {
      tab.cleanup();
    }

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

    expect(locks.heldNames()).toEqual(['ethlete-auth:leader:test-auth']);

    tab.cleanup();
  });

  it('should leave a second tab queued behind the first', async () => {
    const first = openTab();
    const second = openTab();

    await settle();

    expect(first.isLeader()).toBe(true);
    expect(second.isLeader()).toBe(false);
    expect(locks.pendingNames()).toEqual(['ethlete-auth:leader:test-auth']);

    first.cleanup();
    second.cleanup();
  });

  it('should elect a leader per provider name', async () => {
    const hub = openTab('hub');
    const voting = openTab('voting');

    await settle();

    expect(hub.isLeader()).toBe(true);
    expect(voting.isLeader()).toBe(true);
    expect(locks.heldNames()).toEqual(['ethlete-auth:leader:hub', 'ethlete-auth:leader:voting']);
    expect(hub.instanceCount()).toBe(1);
    expect(voting.instanceCount()).toBe(1);

    hub.cleanup();
    voting.cleanup();
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

  it('should deliver a follower’s refresh request to the leader alone', async () => {
    const leader = openTab();
    const follower = openTab();
    const otherFollower = openTab();

    await settle();

    const heard: string[] = [];

    leader.refreshRequests$.subscribe(() => heard.push('leader'));
    otherFollower.refreshRequests$.subscribe(() => heard.push('otherFollower'));

    follower.requestRefresh();
    await settle();

    expect(heard).toEqual(['leader']);

    leader.cleanup();
    follower.cleanup();
    otherFollower.cleanup();
  });

  it('should not deliver a refresh request back to the tab that asked', async () => {
    const tab = openTab();

    await settle();

    const heard: string[] = [];

    tab.refreshRequests$.subscribe(() => heard.push('self'));

    tab.requestRefresh();
    await settle();

    expect(heard).toEqual([]);

    tab.cleanup();
  });

  it('should carry a refresh start to every other tab', async () => {
    const leader = openTab();
    const follower = openTab();

    await settle();

    const heard: string[] = [];

    leader.refreshStarts$.subscribe(() => heard.push('leader'));
    follower.refreshStarts$.subscribe(() => heard.push('follower'));

    leader.announceRefreshStart();
    await settle();

    expect(heard).toEqual(['follower']);

    leader.cleanup();
    follower.cleanup();
  });

  it('should hand the leadership over while the page is frozen', async () => {
    const tab = openTab();

    await settle();

    const otherTab = openForeignTab();

    await settle();

    expect(tab.isLeader()).toBe(true);
    expect(otherTab.isLeader()).toBe(false);

    document.dispatchEvent(new Event('freeze'));
    await settle();

    // A frozen page runs no timer, so a frozen leader is a session nothing refreshes.
    expect(tab.isLeader()).toBe(false);
    expect(otherTab.isLeader()).toBe(true);

    await otherTab.close();
  });

  it('should take part again once the page resumes, behind the tab that took over', async () => {
    const tab = openTab();

    await settle();

    const otherTab = openForeignTab();

    await settle();

    document.dispatchEvent(new Event('freeze'));
    await settle();

    document.dispatchEvent(new Event('resume'));
    await settle();

    expect(tab.isLeader()).toBe(false);
    expect(otherTab.isLeader()).toBe(true);
    expect(locks.pendingNames()).toEqual(['ethlete-auth:leader:test-auth']);

    await otherTab.close();
    await settle();

    expect(tab.isLeader()).toBe(true);
  });

  it('should lead again after a resume that finds no other tab', async () => {
    const tab = openTab();

    await settle();

    document.dispatchEvent(new Event('freeze'));
    await settle();

    expect(tab.isLeader()).toBe(false);
    expect(locks.heldNames()).toEqual([]);

    document.dispatchEvent(new Event('resume'));
    await settle();

    expect(tab.isLeader()).toBe(true);

    tab.cleanup();
  });

  it('should give the leadership up for the back/forward cache, and take it again on restore', async () => {
    const tab = openTab();

    await settle();

    window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));
    await settle();

    expect(tab.isLeader()).toBe(false);
    expect(locks.heldNames()).toEqual([]);

    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    await settle();

    expect(tab.isLeader()).toBe(true);
  });

  it('should keep the leadership on a page hide that is not a cache entry', async () => {
    const leader = openTab();

    await settle();

    window.dispatchEvent(new Event('pagehide'));
    await settle();

    expect(leader.isLeader()).toBe(true);

    leader.cleanup();
  });

  it('should stop reacting to freeze and resume after cleanup', async () => {
    const tab = openTab();

    await settle();

    tab.cleanup();
    await settle();

    document.dispatchEvent(new Event('resume'));
    await settle();

    expect(tab.isLeader()).toBe(false);
    expect(locks.heldNames()).toEqual([]);
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
    expect(tab.isSupported).toBe(false);
    expect(() => tab.cleanup()).not.toThrow();

    locks = installFakeWebLocks();
  });

  it('should report Web Locks as supported when an election actually runs', async () => {
    const tab = openTab();

    await settle();

    expect(tab.isSupported).toBe(true);

    tab.cleanup();
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
