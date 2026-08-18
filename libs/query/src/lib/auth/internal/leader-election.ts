import { computed, DestroyRef, effect, inject, signal, Signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { createQueryKeyLockManager } from '../../http/sync/query-key-lock-manager';

/**
 * Namespace and key of the one lock the whole election is: whoever holds it is the leader, and every
 * other tab of the app is queued behind it. The lock name is what the instance count is derived from,
 * so the two can never disagree about who is taking part. Both carry the provider's name, so two
 * providers reachable from one origin elect a leader each instead of one between them.
 */
const LEADER_LOCK_NAMESPACE = 'ethlete-auth';
const leaderLockKey = (name: string) => `leader:${name}`;
const leaderLockName = (name: string) => `${LEADER_LOCK_NAMESPACE}:${leaderLockKey(name)}`;

/**
 * Web Locks has no "someone joined" event, so tabs announce themselves on this channel. Two messages
 * per tab lifetime, in place of the heartbeat this used to run once a second. It also carries a
 * follower's request for a refresh and the leader's answer that one started, which are the two things
 * a tab can only say over the channel.
 */
const presenceChannelName = (name: string) => `ethlete-auth-leader:${name}`;

type LeaderChannelMessage = { type: 'presence' } | { type: 'refresh-requested' } | { type: 'refresh-started' };

export type InternalLeaderElection = {
  /**
   * Whether this tab is the one doing the work only one tab should do - the proactive token refresh.
   *
   * Starts `false` and flips on the next microtask when nothing else holds the lock: the platform
   * grants asynchronously, and the refresh this gates runs off a timer, so nothing observes the gap.
   */
  isLeader: Signal<boolean>;

  /**
   * How many tabs of this app currently take part in the election. Telemetry only - `withTracking`
   * emits it - and best-effort: it is recounted when a tab announces itself, says goodbye, or takes
   * over the leadership, not on a timer. A tab that *crashes* without being the leader is therefore
   * still counted until the next of those happens.
   */
  instanceCount: Signal<number>;

  /**
   * Whether the browser has the Web Locks API. Without it there is no election at all: every tab
   * holds, so every tab reads as the leader and {@link instanceCount} stays at one.
   */
  isSupported: boolean;

  /**
   * Asks the leader to refresh the session's tokens. What a tab that hit a 401 does instead of
   * refreshing itself, which would spend a single-use refresh token the leader also holds.
   */
  requestRefresh: () => void;

  /** Emits in the leader tab whenever another tab called {@link requestRefresh}. */
  refreshRequests$: Observable<void>;

  /**
   * Tells the other tabs that a refresh started here. The answer to {@link requestRefresh}, which is
   * otherwise a message with no ack: without it a follower cannot tell a leader that is working on
   * the refresh from one that will never act on it.
   */
  announceRefreshStart: () => void;

  /** Emits whenever another tab called {@link announceRefreshStart}. */
  refreshStarts$: Observable<void>;

  /** Releases the lock and leaves the channel. Idempotent, and also run on destroy. */
  cleanup: () => void;
};

const countLeaderRequests = (snapshot: LockManagerSnapshot, lockName: string) => {
  const isLeaderLock = (info: LockInfo) => info.name === lockName;

  // Held plus pending is exactly the tab count: every tab requests this one lock, one gets it and the
  // rest queue. The platform drops a crashed tab from both lists on its own.
  return (snapshot.held?.filter(isLeaderLock).length ?? 0) + (snapshot.pending?.filter(isLeaderLock).length ?? 0);
};

/**
 * Elects the one tab that refreshes the session's tokens, over the
 * [Web Locks API](https://developer.mozilla.org/docs/Web/API/Web_Locks_API).
 *
 * The lock does the whole job: requests queue FIFO, so the tab that has been waiting longest takes
 * over, and a holder that closes, crashes or navigates away has its lock released by the platform.
 * No heartbeat, no timeout to tune, and no window in which two tabs both believe they are the leader.
 *
 * Degrades to "this tab is the leader" without Web Locks - the same single-tab behavior the previous
 * `localStorage` implementation fell back to, and the only safe default: a session that refreshes its
 * token in every tab is wasteful, one that refreshes it in none logs the user out.
 */
export const setupLeaderElection = (options: { name: string }): InternalLeaderElection => {
  const destroyRef = inject(DestroyRef);

  const lockName = leaderLockName(options.name);
  const lockManager = createQueryKeyLockManager(LEADER_LOCK_NAMESPACE);
  const requestLeadership = () => lockManager.hold(leaderLockKey(options.name));
  const hold = signal(requestLeadership());
  const isLeader = computed(() => hold().isHolder());
  const instanceCount = signal(1);
  const refreshRequests = new Subject<void>();
  const refreshStarts = new Subject<void>();

  const noop = () => {
    /* nothing was set up */
  };

  // `hold.isHolder` is already `true` in this case, so the tab reads as the leader it effectively is,
  // and asks nobody else for a refresh.
  if (!lockManager.isSupported) {
    return {
      isLeader,
      instanceCount: instanceCount.asReadonly(),
      isSupported: false,
      requestRefresh: noop,
      refreshRequests$: refreshRequests.asObservable(),
      announceRefreshStart: noop,
      refreshStarts$: refreshStarts.asObservable(),
      cleanup: noop,
    };
  }

  const channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(presenceChannelName(options.name));

  let isDestroyed = false;
  let isParticipating = true;

  const recount = async () => {
    const snapshot = await navigator.locks.query();

    if (isDestroyed) return;

    // Never below one: the snapshot can be taken before this tab's own request is registered, and a
    // count of zero would say the app is not running in the tab reading it.
    instanceCount.set(Math.max(countLeaderRequests(snapshot, lockName), 1));
  };

  const post = (message: LeaderChannelMessage) => channel?.postMessage(message);

  const announce = () => post({ type: 'presence' });

  const requestRefresh = () => post({ type: 'refresh-requested' });

  const announceRefreshStart = () => post({ type: 'refresh-started' });

  if (channel) {
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data as LeaderChannelMessage | null;

      if (message?.type === 'presence') {
        void recount();

        return;
      }

      if (message?.type === 'refresh-started') {
        refreshStarts.next();

        return;
      }

      // Every tab hears the request; only the one that may spend the refresh token acts on it.
      if (message?.type === 'refresh-requested' && isLeader()) {
        refreshRequests.next();
      }
    };
  }

  effect(() => {
    if (!isLeader()) return;

    // Becoming the leader means the previous one went away. A tab that closed normally announced it
    // itself, one that crashed did not - so this is the moment to tell the others for free.
    announce();
    void recount();
  });

  /**
   * Leaves the election, because this tab is about to stop running. A frozen page keeps its lock while
   * its timers do not fire, so a leader that stays in would be a leader that refreshes nothing, and
   * every other tab would sit queued behind it until the user came back. The lock is not requested
   * again here: the platform would grant it to this page just as well while it is frozen.
   */
  const leaveElection = () => {
    if (isDestroyed || !isParticipating) return;

    isParticipating = false;

    // Release before the goodbye: the tabs that recount on it should no longer see this one queued.
    hold().release();
    announce();
  };

  /** Takes part again, behind whichever tab took the leadership over in the meantime. */
  const rejoinElection = () => {
    if (isDestroyed || isParticipating) return;

    isParticipating = true;
    hold.set(requestLeadership());
    announce();
    void recount();
  };

  const isRestoredFromCache = (event: Event) => (event as PageTransitionEvent).persisted === true;

  const onFreeze = () => leaveElection();
  const onResume = () => rejoinElection();
  const onPageHide = (event: Event) => {
    if (isRestoredFromCache(event)) leaveElection();
  };
  const onPageShow = (event: Event) => {
    if (isRestoredFromCache(event)) rejoinElection();
  };

  // `freeze`/`resume` is Chromium's; `pagehide`/`pageshow` with `persisted` is how a page enters and
  // leaves the back/forward cache, which stops it just as dead in browsers that fire no `freeze`.
  if (typeof document !== 'undefined') {
    document.addEventListener('freeze', onFreeze);
    document.addEventListener('resume', onResume);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
  }

  announce();
  void recount();

  const cleanup = () => {
    if (isDestroyed) return;

    isDestroyed = true;

    if (typeof document !== 'undefined') {
      document.removeEventListener('freeze', onFreeze);
      document.removeEventListener('resume', onResume);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    }

    hold().release();
    announce();
    channel?.close();
    refreshRequests.complete();
    refreshStarts.complete();
  };

  destroyRef.onDestroy(cleanup);

  return {
    isLeader,
    instanceCount: instanceCount.asReadonly(),
    isSupported: true,
    requestRefresh,
    refreshRequests$: refreshRequests.asObservable(),
    announceRefreshStart,
    refreshStarts$: refreshStarts.asObservable(),
    cleanup,
  };
};
