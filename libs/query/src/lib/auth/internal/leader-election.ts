import { DestroyRef, effect, inject, signal, Signal } from '@angular/core';
import { createQueryKeyLockManager } from '../../http/sync/query-key-lock-manager';

/**
 * Namespace and key of the one lock the whole election is: whoever holds it is the leader, and every
 * other tab of the app is queued behind it. The lock name is what the instance count is derived from,
 * so the two can never disagree about who is taking part.
 */
const LEADER_LOCK_NAMESPACE = 'ethlete-auth';
const LEADER_LOCK_KEY = 'leader';
const LEADER_LOCK_NAME = `${LEADER_LOCK_NAMESPACE}:${LEADER_LOCK_KEY}`;

/**
 * Web Locks has no "someone joined" event, so tabs announce themselves on this channel. Two messages
 * per tab lifetime, in place of the heartbeat this used to run once a second.
 */
const PRESENCE_CHANNEL_NAME = 'ethlete-auth-leader';

type LeaderPresenceMessage = { type: 'presence' };

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

  /** Releases the lock and leaves the channel. Idempotent, and also run on destroy. */
  cleanup: () => void;
};

const countLeaderRequests = (snapshot: LockManagerSnapshot) => {
  const isLeaderLock = (info: LockInfo) => info.name === LEADER_LOCK_NAME;

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
export const setupLeaderElection = (): InternalLeaderElection => {
  const destroyRef = inject(DestroyRef);

  const lockManager = createQueryKeyLockManager(LEADER_LOCK_NAMESPACE);
  const hold = lockManager.hold(LEADER_LOCK_KEY);
  const instanceCount = signal(1);

  const noopCleanup = () => {
    /* nothing was set up */
  };

  // `hold.isHolder` is already `true` in this case, so the tab reads as the leader it effectively is.
  if (!lockManager.isSupported) {
    return { isLeader: hold.isHolder, instanceCount: instanceCount.asReadonly(), cleanup: noopCleanup };
  }

  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(PRESENCE_CHANNEL_NAME);

  let isDestroyed = false;

  const recount = async () => {
    const snapshot = await navigator.locks.query();

    if (isDestroyed) return;

    // Never below one: the snapshot can be taken before this tab's own request is registered, and a
    // count of zero would say the app is not running in the tab reading it.
    instanceCount.set(Math.max(countLeaderRequests(snapshot), 1));
  };

  const announce = () => channel?.postMessage({ type: 'presence' } satisfies LeaderPresenceMessage);

  if (channel) {
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if ((event.data as LeaderPresenceMessage | null)?.type !== 'presence') return;

      void recount();
    };
  }

  effect(() => {
    if (!hold.isHolder()) return;

    // Becoming the leader means the previous one went away. A tab that closed normally announced it
    // itself, one that crashed did not - so this is the moment to tell the others for free.
    announce();
    void recount();
  });

  announce();
  void recount();

  const cleanup = () => {
    if (isDestroyed) return;

    isDestroyed = true;

    // Release before the goodbye: the tabs that recount on it should no longer see this one queued.
    hold.release();
    announce();
    channel?.close();
  };

  destroyRef.onDestroy(cleanup);

  return { isLeader: hold.isHolder, instanceCount: instanceCount.asReadonly(), cleanup };
};
