import type { PersistedQueryEntry, PersistedQueryEntryMeta, QueryPersistenceAdapter } from '@ethlete/query';

/**
 * An in-memory stand-in for the query client's persisted response store.
 *
 * jsdom has no IndexedDB at all, so this is how persistence is tested - and because the storage
 * adapter is a documented seam rather than a mock of one, a spec running against this exercises the
 * real engine, repository and request code on both the write and the read side.
 *
 * Everything resolves on a microtask, never synchronously, matching the real thing: `await
 * Promise.resolve()` (or `flushMicrotasks`) is what lets a hydration land in a spec.
 */
export type FakeQueryPersistenceStoreHandle = {
  /** Pass this as `persistence: { adapter }`. Two clients sharing one handle share one store. */
  adapter: QueryPersistenceAdapter;

  /** Pre-populates the store, as if a previous session had written these entries. */
  seed: (entries: PersistedQueryEntry[]) => void;

  /** Every entry currently held, in insertion order. */
  entries: () => PersistedQueryEntry[];

  /** The entry held under `key`, or `undefined`. */
  entry: (key: string) => PersistedQueryEntry | undefined;

  /** How often each adapter method has been called. */
  calls: () => Record<'loadIndex' | 'read' | 'write' | 'remove' | 'clear', number>;

  /** Makes the next `count` writes reject - a full disk, by default. */
  failNextWrites: (count: number, error?: unknown) => void;

  /** Makes the next `loadIndex` reject. */
  failNextLoadIndex: (error?: unknown) => void;

  /**
   * Holds every subsequent `read` pending until {@link flushReads} is called, for testing the window
   * between a cold mount and its hydration (a slow disk, or a mount that happened before startup
   * finished).
   */
  deferReads: () => void;

  /** Settles the reads held by {@link deferReads} and stops deferring. */
  flushReads: () => Promise<void>;
};

const quotaError = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError');

export const createFakeQueryPersistenceStore = (): FakeQueryPersistenceStoreHandle => {
  const store = new Map<string, PersistedQueryEntry>();
  const calls = { loadIndex: 0, read: 0, write: 0, remove: 0, clear: 0 };
  const deferredReads: Array<() => void> = [];

  let failingWrites = 0;
  let writeError: unknown = null;
  let loadIndexError: unknown = null;
  let isDeferringReads = false;

  // Cloning on the way in and on the way out is not pedantry: a real store hands back a copy, so a
  // spec (or the engine) mutating a hydrated body must not be able to change what is "on disk".
  const clone = <T>(value: T): T => structuredClone(value);

  const loadIndex = async () => {
    calls.loadIndex++;

    if (loadIndexError !== null) {
      const error = loadIndexError;
      loadIndexError = null;

      throw error;
    }

    return Array.from(store.values()).map(({ body: _body, ...meta }) => clone(meta) satisfies PersistedQueryEntryMeta);
  };

  const read = async (key: string) => {
    calls.read++;

    if (isDeferringReads) {
      await new Promise<void>((resolve) => deferredReads.push(resolve));
    }

    const entry = store.get(key);

    return entry ? { body: clone(entry.body) } : null;
  };

  const write = async (entries: PersistedQueryEntry[]) => {
    calls.write++;

    if (failingWrites > 0) {
      failingWrites--;

      throw writeError ?? quotaError();
    }

    for (const entry of entries) {
      store.set(entry.key, clone(entry));
    }
  };

  const remove = async (keys: string[]) => {
    calls.remove++;

    for (const key of keys) {
      store.delete(key);
    }
  };

  const clear = async () => {
    calls.clear++;
    store.clear();
  };

  return {
    adapter: { loadIndex, read, write, remove, clear, isSupported: true },
    seed: (entries) => {
      for (const entry of entries) {
        store.set(entry.key, clone(entry));
      }
    },
    entries: () => Array.from(store.values()).map(clone),
    entry: (key) => {
      const entry = store.get(key);

      return entry ? clone(entry) : undefined;
    },
    calls: () => ({ ...calls }),
    failNextWrites: (count, error) => {
      failingWrites = count;
      writeError = error ?? null;
    },
    failNextLoadIndex: (error) => {
      loadIndexError = error ?? quotaError();
    },
    deferReads: () => {
      isDeferringReads = true;
    },
    flushReads: async () => {
      isDeferringReads = false;

      const pending = deferredReads.splice(0, deferredReads.length);

      for (const resolve of pending) {
        resolve();
      }

      await Promise.resolve();
    },
  };
};
