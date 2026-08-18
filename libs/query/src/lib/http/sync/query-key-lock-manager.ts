import { Signal, signal } from '@angular/core';

/** How a hold is requested, and how it reports back when it is taken away. */
export type QueryKeyLockHoldOptions = {
  /**
   * Takes the key from whoever holds it instead of queueing behind them, and preempts every request
   * already queued for it. For the one case a queue cannot answer: a holder that stopped running -
   * a frozen or suspended tab - keeps its lock while it does none of the work the lock stands for,
   * and nothing it does not run can hand it over.
   *
   * The tab it is taken from hears about it through {@link onLost}.
   */
  steal?: boolean;

  /**
   * Called when another tab took this key over while this hold had it. Not called for a release of
   * this tab's own, and not for a queued request that was aborted.
   */
  onLost?: () => void;
};

/** A single outstanding request for the lock of one key. */
export type QueryKeyLockHold = {
  /**
   * Whether this tab currently holds the lock. Starts `false` - the lock is granted asynchronously,
   * and while another tab holds it this stays `false` until that tab goes away.
   */
  isHolder: Signal<boolean>;

  /**
   * Gives the lock up, or cancels the request while it is still queued. Idempotent, so it is safe to
   * call from both a cleanup path and an explicit handoff.
   */
  release: () => void;
};

/**
 * Where a tab stands on one key: `holder` means it is the tab doing the work, `standby` that it is
 * queued behind another tab and skipping the work in the meantime.
 */
export type QueryKeyLockState = 'holder' | 'standby';

/**
 * Elects one tab per key, so work that only one tab needs to do (polling a cache key) happens once
 * per browser instead of once per tab.
 *
 * Backed by the Web Locks API, which solves the parts that make hand-rolled leader election
 * unpleasant: requests queue FIFO, and a holder that closes, crashes or navigates away releases its
 * lock automatically - no heartbeats, no split-brain window.
 */
export type QueryKeyLockManager = {
  /** Requests the lock for `key`. */
  hold: (key: string, options?: QueryKeyLockHoldOptions) => QueryKeyLockHold;

  /**
   * Whether the Web Locks API backs this manager. When `false` every caller is immediately the
   * holder of every key, which degrades to "every tab does the work itself".
   */
  isSupported: boolean;

  /**
   * Every key this tab has an outstanding hold for, and where it stands on it. Reactive, and read by
   * the query devtools to answer "why isn't this tab polling?" - not part of the general contract.
   */
  keyStates: Signal<Record<string, QueryKeyLockState>>;
};

const noop = () => undefined;

/** Shared because it never changes: without Web Locks, every hold is granted and never lost. */
const alwaysHolder: QueryKeyLockHold = { isHolder: /* @__PURE__ */ signal(true).asReadonly(), release: noop };
const noKeyStates = /* @__PURE__ */ signal<Record<string, QueryKeyLockState>>({}).asReadonly();

export const createQueryKeyLockManager = (namespace: string): QueryKeyLockManager => {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;

  if (!locks) return { hold: () => alwaysHolder, isSupported: false, keyStates: noKeyStates };

  const activeHolds = new Set<{ key: string; isHolder: Signal<boolean> }>();
  const keyStates = signal<Record<string, QueryKeyLockState>>({});

  // Recomputed imperatively rather than derived: the set of holds is not itself reactive, and the
  // three moments it can change (requested, granted, released) are all right here.
  const publishKeyStates = () => {
    const states: Record<string, QueryKeyLockState> = {};

    for (const activeHold of activeHolds) {
      if (activeHold.isHolder()) {
        states[activeHold.key] = 'holder';
      } else if (!states[activeHold.key]) {
        states[activeHold.key] = 'standby';
      }
    }

    keyStates.set(states);
  };

  const hold = (key: string, options: QueryKeyLockHoldOptions = {}): QueryKeyLockHold => {
    const isHolder = signal(false);
    const abortController = new AbortController();
    const activeHold = { key, isHolder: isHolder.asReadonly() };

    let releaseHeldLock: (() => void) | null = null;
    let isReleased = false;
    let wasGranted = false;

    activeHolds.add(activeHold);
    publishKeyStates();

    const release = () => {
      if (isReleased) return;

      isReleased = true;
      isHolder.set(false);
      activeHolds.delete(activeHold);
      publishKeyStates();

      // Exactly one of these applies: the lock is ours, so resolving the promise the platform is
      // waiting on hands it to the next tab in line - or the request is still queued, and aborting
      // takes it out of the queue.
      if (releaseHeldLock) {
        releaseHeldLock();
      } else {
        abortController.abort();
      }
    };

    // A stealing request is granted on the spot, so it never queues and has nothing to abort - and
    // the platform rejects `signal` together with `steal` outright.
    const requestOptions: LockOptions = options.steal ? { steal: true } : { signal: abortController.signal };

    locks
      .request(`${namespace}:${key}`, requestOptions, () => {
        // Aborting a request the platform has already granted does nothing, so a release that raced
        // the grant lands here instead: take the lock and give it straight back.
        if (isReleased) return Promise.resolve();

        wasGranted = true;
        isHolder.set(true);
        publishKeyStates();

        return new Promise<void>((resolve) => {
          releaseHeldLock = resolve;
        });
      })
      .catch(() => {
        // A queued request that gets aborted rejects with an `AbortError`, which is the normal way a
        // standby hold ends. Nothing to recover from in either case - this tab is simply not the
        // holder, which is what the signal already says.
        isHolder.set(false);

        // A hold that had the lock only ends in a rejection one way: another tab stole it. This one
        // is over, so it leaves the published states behind and lets the caller decide what comes next.
        if (!wasGranted || isReleased) return;

        activeHolds.delete(activeHold);
        publishKeyStates();
        options.onLost?.();
      });

    return { isHolder: activeHold.isHolder, release };
  };

  return { hold, isSupported: true, keyStates: keyStates.asReadonly() };
};
