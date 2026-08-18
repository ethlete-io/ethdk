import { TestBed } from '@angular/core/testing';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
 * Puts the one shared `document` into a visibility state and tells the tabs about it, which is how a
 * spec says "the user is looking at this tab" or "this tab is in the background".
 */
const setVisibility = (state: 'visible' | 'hidden', options: { notify?: boolean } = {}) => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

  if (options.notify ?? true) document.dispatchEvent(new Event('visibilitychange'));
};

/**
 * A tab that is not an election instance, so it hears none of the page lifecycle events the specs
 * dispatch on the one shared `document` - which is the only way to tell two tabs apart in here. It
 * answers a claim the way a running tab does, unless the spec asks for one that answers nothing.
 */
const openForeignTab = (
  options: { name?: string; answersClaims?: boolean; isVisible?: boolean } = {},
): {
  isLeader: () => boolean;
  claim: () => void;
  steal: () => void;
  close: () => Promise<void>;
} => {
  const name = options.name ?? 'test-auth';
  const answersClaims = options.answersClaims ?? true;
  const isVisible = options.isVisible ?? true;

  let isLeader = false;
  let release = () => {
    /* not granted yet */
  };
  let abort = () => {
    /* nothing requested yet */
  };
  let done: Promise<unknown> = Promise.resolve();

  // Whichever of the two applies: the request is granted, so releasing it ends it, or it is still
  // queued, so aborting does. Leaving either behind would keep this tab in the election.
  const stopRequest = () => {
    release();
    abort();
  };

  const request = (steal = false) => {
    stopRequest();

    const controller = new AbortController();

    abort = () => controller.abort();

    done = navigator.locks
      .request(
        `ethlete-auth:leader:${name}`,
        // The platform rejects a signal together with a steal, which is granted on the spot anyway.
        steal ? { steal: true } : { signal: controller.signal },
        () => {
          isLeader = true;

          return new Promise<void>((resolve) => {
            release = () => {
              isLeader = false;
              resolve();
            };
          });
        },
      )
      .catch(() => {
        isLeader = false;
      });
  };

  request();

  const channel = new BroadcastChannel(`ethlete-auth-leader:${name}`);

  channel.onmessage = (event: MessageEvent<unknown>) => {
    if ((event.data as { type?: string })?.type !== 'claim' || !answersClaims || !isLeader) return;

    channel.postMessage({ type: 'leader-alive', isVisible });

    // What a hidden tab does with a claim: it answers, and then steps aside for the tab the user is
    // actually looking at.
    if (!isVisible) request();
  };

  return {
    isLeader: () => isLeader,
    claim: () => channel.postMessage({ type: 'claim' }),
    steal: () => request(true),
    close: async () => {
      channel.close();
      stopRequest();
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

    setVisibility('visible');

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

  it('should give the leadership up when the page is hidden', async () => {
    const tab = openTab();

    await settle();

    const otherTab = openForeignTab();

    await settle();

    expect(tab.isLeader()).toBe(true);

    setVisibility('hidden');
    await settle();

    // A hidden tab has its timers throttled to about once a minute, so leading from one is leading
    // nothing. It stays in the election and gets the lock straight back if nobody else wants it.
    expect(tab.isLeader()).toBe(false);
    expect(otherTab.isLeader()).toBe(true);

    await otherTab.close();
  });

  it('should keep leading while it is hidden and no other tab wants it', async () => {
    const tab = openTab();

    await settle();

    setVisibility('hidden');
    await settle();

    expect(tab.isLeader()).toBe(true);
  });

  it('should take the leadership back from a hidden tab when the page becomes visible', async () => {
    const otherTab = openForeignTab({ isVisible: false });

    await settle();

    setVisibility('hidden');

    const tab = openTab();

    await settle();

    expect(tab.isLeader()).toBe(false);
    expect(otherTab.isLeader()).toBe(true);

    setVisibility('visible');
    await settle();

    expect(tab.isLeader()).toBe(true);
    expect(otherTab.isLeader()).toBe(false);

    await otherTab.close();
  });

  it('should give way to a claim from another tab while it is hidden', async () => {
    const tab = openTab();

    await settle();

    const otherTab = openForeignTab();

    await settle();

    // Hidden without the event, so the claim is the only thing that can move the lock here.
    setVisibility('hidden', { notify: false });

    expect(tab.isLeader()).toBe(true);

    otherTab.claim();
    await settle();

    expect(tab.isLeader()).toBe(false);
    expect(otherTab.isLeader()).toBe(true);

    await otherTab.close();
  });

  it('should take the leadership off a leader that answers nothing', async () => {
    vi.useFakeTimers();

    try {
      const otherTab = openForeignTab({ answersClaims: false });

      await settle();

      const tab = openTab();

      await settle();

      expect(tab.isLeader()).toBe(false);
      expect(otherTab.isLeader()).toBe(true);

      // A frozen or suspended tab keeps the lock while it runs no timer and reads no message, so
      // nothing it could do hands the leadership over. Asking has to run out.
      vi.advanceTimersByTime(2000);
      await settle();

      expect(tab.isLeader()).toBe(true);
      expect(otherTab.isLeader()).toBe(false);

      await otherTab.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should leave a leader that is visible alone', async () => {
    vi.useFakeTimers();

    try {
      const otherTab = openForeignTab();

      await settle();

      const tab = openTab();

      await settle();

      vi.advanceTimersByTime(2000);
      await settle();

      // One visible tab leading is as good as another, and taking the lock off it would only move the
      // work between two tabs that are both awake.
      expect(tab.isLeader()).toBe(false);
      expect(otherTab.isLeader()).toBe(true);

      await otherTab.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should rejoin the queue after another tab takes the lock over', async () => {
    const tab = openTab();

    await settle();

    expect(tab.isLeader()).toBe(true);

    const otherTab = openForeignTab();

    otherTab.steal();
    await settle();

    expect(tab.isLeader()).toBe(false);
    expect(otherTab.isLeader()).toBe(true);
    expect(locks.pendingNames()).toEqual(['ethlete-auth:leader:test-auth']);

    await otherTab.close();
    await settle();

    expect(tab.isLeader()).toBe(true);
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
