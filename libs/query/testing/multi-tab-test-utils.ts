/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Test doubles for the two browser APIs the query client's multi-tab sync is built on:
 * `BroadcastChannel` and the Web Locks API (`navigator.locks`).
 *
 * Both fakes are process-wide and shared between every consumer created while they are installed,
 * which is exactly what makes "two tabs" testable: create two query clients in one test and they
 * talk to each other over the fake bus and contend for the same fake locks, going through the real
 * production code path on both sides.
 *
 * Neither jsdom nor happy-dom can stand in here - jsdom ships a `BroadcastChannel` that never
 * delivers to other instances, and no `navigator.locks` at all.
 */

/** Something posted on the fake bus, as seen by a receiver. */
export type FakeBroadcastMessage = {
  /** The channel name it was posted on. */
  channel: string;

  /** The structured-cloned payload. */
  data: unknown;
};

export type FakeBroadcastChannelHandle = {
  /** Every message posted on the bus, in order, across all channel names. */
  posted: FakeBroadcastMessage[];

  /** Uninstalls the fake and restores whatever `BroadcastChannel` was there before. */
  restore: () => void;
};

type FakeChannelInstance = {
  name: string;
  closed: boolean;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
};

/**
 * Replaces `globalThis.BroadcastChannel` with an in-memory bus.
 *
 * Messages are structured-cloned at post time (so a non-cloneable payload throws exactly like the
 * real API does), delivered on a microtask (never synchronously), and never delivered back to the
 * channel that posted them - all three matching browser behavior. `await Promise.resolve()` in a
 * spec is enough to flush delivery.
 */
export const installFakeBroadcastChannel = (): FakeBroadcastChannelHandle => {
  const original = (globalThis as any).BroadcastChannel;
  const instances = new Set<FakeChannelInstance>();
  const posted: FakeBroadcastMessage[] = [];

  class FakeBroadcastChannel implements FakeChannelInstance {
    closed = false;
    onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

    constructor(public name: string) {
      instances.add(this);
    }

    postMessage(data: unknown) {
      if (this.closed) throw new DOMException('Channel is closed', 'InvalidStateError');

      const clone = structuredClone(data);

      posted.push({ channel: this.name, data: clone });

      for (const instance of instances) {
        if (instance === this || instance.closed || instance.name !== this.name) continue;

        queueMicrotask(() => {
          if (instance.closed) return;

          instance.onmessage?.({ data: structuredClone(clone) } as MessageEvent<unknown>);
        });
      }
    }

    close() {
      this.closed = true;
      instances.delete(this);
    }

    addEventListener() {
      throw new Error('The fake BroadcastChannel only supports `onmessage`.');
    }
  }

  (globalThis as any).BroadcastChannel = FakeBroadcastChannel;

  return {
    posted,
    restore: () => {
      for (const instance of [...instances]) {
        instance.closed = true;
      }

      instances.clear();
      (globalThis as any).BroadcastChannel = original;
    },
  };
};

export type FakeWebLocksHandle = {
  /** The names currently held, in no particular order. */
  heldNames: () => string[];

  /** The names with at least one request queued behind the holder. */
  pendingNames: () => string[];

  /** Uninstalls the fake and restores whatever `navigator.locks` was there before. */
  restore: () => void;
};

type FakeLockWaiter = {
  callback: (lock: Lock) => unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  granted: boolean;
};

/**
 * Installs an in-memory `navigator.locks` implementing exclusive locks: one holder per name, the
 * rest queued FIFO, granted on a microtask (never synchronously), released when the callback's
 * promise settles. `signal` is honored for queued requests and - as in the real API - ignored once a
 * request has been granted.
 *
 * `mode: 'shared'`, `ifAvailable` and `steal` are not implemented; nothing in the library uses them.
 */
export const installFakeWebLocks = (): FakeWebLocksHandle => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
  const holders = new Map<string, FakeLockWaiter>();
  const queues = new Map<string, FakeLockWaiter[]>();

  const abortError = () => new DOMException('The lock request was aborted', 'AbortError');

  const pump = (name: string) => {
    if (holders.has(name)) return;

    const waiter = queues.get(name)?.shift();

    if (!waiter) return;

    waiter.granted = true;
    holders.set(name, waiter);

    const settle = (settleWaiter: () => void) => {
      holders.delete(name);
      settleWaiter();
      pump(name);
    };

    // `pump` itself only ever runs from a microtask, so calling the callback right here keeps the
    // grant exactly one microtask away from the `request()` call - which is what makes a single
    // `flushMultiTabSync()` per hop enough in specs.
    try {
      Promise.resolve(waiter.callback({ name, mode: 'exclusive' } as Lock)).then(
        (value) => settle(() => waiter.resolve(value)),
        (error) => settle(() => waiter.reject(error)),
      );
    } catch (error) {
      settle(() => waiter.reject(error));
    }
  };

  const request = (name: string, optionsOrCallback: unknown, maybeCallback?: unknown) => {
    const options = (typeof optionsOrCallback === 'function' ? {} : (optionsOrCallback ?? {})) as LockOptions;
    const callback = (typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback) as (
      lock: Lock,
    ) => unknown;

    return new Promise((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(abortError());

        return;
      }

      const waiter: FakeLockWaiter = { callback, resolve, reject, granted: false };

      options.signal?.addEventListener('abort', () => {
        if (waiter.granted) return;

        const queue = queues.get(name);

        if (queue)
          queues.set(
            name,
            queue.filter((entry) => entry !== waiter),
          );

        reject(abortError());
      });

      queues.set(name, [...(queues.get(name) ?? []), waiter]);
      queueMicrotask(() => pump(name));
    });
  };

  // Both lists are reported, because a queued request is how a tab that is *not* the holder still
  // shows up - which is what the auth leader election counts its tabs by.
  const query = () =>
    Promise.resolve({
      held: [...holders.keys()].map((name) => ({ name, mode: 'exclusive' as const })),
      pending: [...queues.entries()].flatMap(([name, waiters]) =>
        waiters.map(() => ({ name, mode: 'exclusive' as const })),
      ),
    });

  Object.defineProperty(navigator, 'locks', {
    value: {
      request,
      query,
    },
    configurable: true,
    writable: true,
  });

  return {
    heldNames: () => [...holders.keys()],
    pendingNames: () => [...queues.entries()].filter(([, queue]) => queue.length > 0).map(([name]) => name),
    restore: () => {
      holders.clear();
      queues.clear();

      if (originalDescriptor) {
        Object.defineProperty(navigator, 'locks', originalDescriptor);
      } else {
        delete (navigator as any).locks;
      }
    },
  };
};

/**
 * Flushes the microtask queue, which is where both fakes schedule their work - message delivery and
 * lock grants. Awaiting it once is enough for a single hop; a grant that has to wait for another
 * tab's release needs one await per hop.
 */
export const flushMultiTabSync = () => Promise.resolve();
