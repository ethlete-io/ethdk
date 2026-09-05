import { isDevMode } from '@angular/core';
import { QueryKey, QueryRepository, QueryRepositoryEvent } from '../query-repository';
import { PersistedQueryBody, PersistedQueryEntry, PersistedQueryEntryMeta } from './persisted-query-entry';
import { QueryPersistenceAdapter } from './query-persistence-adapter';
import {
  DEFAULT_QUERY_PERSISTENCE_MAX_AGE,
  DEFAULT_QUERY_PERSISTENCE_MAX_ENTRIES,
  DEFAULT_QUERY_PERSISTENCE_VERSION,
  DEFAULT_QUERY_PERSISTENCE_WRITE_DELAY,
  QueryPersistenceConfig,
} from './query-persistence-config';

/**
 * The per-client machinery behind the {@link withQueryPersistence} feature: it writes
 * successful reads to the store, reads them back into cache entries a consumer just created, and owns
 * every policy around that - staleness, the entry cap, and the purge a logout triggers.
 *
 * Reachable via `client.subtle.persistence`, and `null` on a client that turned persistence off (or on
 * the server).
 */
export type QueryPersistenceEngine = {
  /**
   * Resolves once the store's index has been read, after which a cold cache entry can be hydrated
   * without waiting. Entries created before that are hydrated as soon as it resolves, so nothing is
   * lost by not awaiting it - see {@link QueryClient.whenPersistenceReady}.
   */
  whenReady: Promise<void>;

  /** Writes everything still queued, now. */
  flush: () => Promise<void>;

  /** Removes every persisted response of this client. */
  clear: () => Promise<void>;

  /** The metadata of everything the store holds, for the devtools. Bodies are not read. */
  indexEntries: () => PersistedQueryEntryMeta[];

  /** Stops listening, flushes one last time. */
  destroy: () => void;
};

export type CreateQueryPersistenceEngineOptions = {
  config: QueryPersistenceConfig;
  repository: QueryRepository;
  adapter: QueryPersistenceAdapter;
};

export const createQueryPersistenceEngine = (options: CreateQueryPersistenceEngineOptions): QueryPersistenceEngine => {
  const { config, repository, adapter } = options;

  const version = config.version ?? DEFAULT_QUERY_PERSISTENCE_VERSION;
  const maxAge = config.maxAge ?? DEFAULT_QUERY_PERSISTENCE_MAX_AGE;
  const maxEntries = config.maxEntries ?? DEFAULT_QUERY_PERSISTENCE_MAX_ENTRIES;
  const writeDelay = config.writeDelay ?? DEFAULT_QUERY_PERSISTENCE_WRITE_DELAY;

  /** What the store holds, without the bodies. Every policy decision is made against this. */
  const index = new Map<QueryKey, PersistedQueryEntryMeta>();

  /** Coalesced writes, newest body per key, flushed as one batch. */
  const pendingWrites = new Map<QueryKey, PersistedQueryEntry>();

  /** Cache entries that were created before the index finished loading. */
  const pendingHydrations = new Set<QueryKey>();

  /** Keys the store refused to remove. Retried by the next removal and by the next flush. */
  const pendingRemovals = new Set<QueryKey>();

  let writeTimer: ReturnType<typeof setTimeout> | undefined;
  let isReady = false;
  let isDestroyed = false;
  let areWritesDisabled = false;
  let isSecurePurgeDeferred = false;
  let storeGeneration = 0;
  let markReady!: () => void;

  const whenReady = new Promise<void>((resolve) => (markReady = resolve));

  /**
   * Every task that touches the store runs through here, one at a time. A flush is already async by
   * the time the batch leaves for disk, so a logout purge or a clear starting in that window would
   * otherwise have the write land behind it and put the data back.
   */
  let storeChain: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>) => {
    const run = storeChain.catch(() => undefined).then(task);

    storeChain = run.catch(() => undefined);

    return run;
  };

  const isExpired = (meta: PersistedQueryEntryMeta, now = Date.now()) => meta.persistedAt + maxAge <= now;

  const metaOf = ({ body: _body, ...meta }: PersistedQueryEntry): PersistedQueryEntryMeta => meta;

  const removeKeys = async (keys: QueryKey[]) => {
    for (const key of keys) {
      pendingRemovals.add(key);
    }

    if (!pendingRemovals.size) return;

    const batch = Array.from(pendingRemovals);

    // The index drops the keys whether or not the store obliges: a body that could not be removed must
    // never be hydrated again, and `pendingRemovals` is what keeps it reachable for the next attempt
    // rather than invisible on disk forever.
    for (const key of batch) {
      index.delete(key);
    }

    await adapter.remove(batch);

    for (const key of batch) {
      pendingRemovals.delete(key);
    }
  };

  const enforceMaxEntries = async () => {
    if (index.size <= maxEntries) return;

    const byAge = Array.from(index.values()).sort((a, b) => a.persistedAt - b.persistedAt);
    const excess = byAge.slice(0, index.size - maxEntries).map((meta) => meta.key);

    await removeKeys(excess);
  };

  const purgeSecure = () => {
    // Dropping the queued bodies is not deferred like the disk half below: a flush scheduled before
    // the logout would otherwise still be holding them when it runs, and put the data back on disk
    // moments after it left memory.
    for (const [key, entry] of pendingWrites) {
      if (entry.isSecure) pendingWrites.delete(key);
    }

    return enqueue(async () => {
      const secureKeys = Array.from(index.values())
        .filter((meta) => meta.isSecure)
        .map((meta) => meta.key);

      await removeKeys(secureKeys);
    });
  };

  const adoptStoredIndex = async (storedIndex: PersistedQueryEntryMeta[]) => {
    const now = Date.now();
    const droppedKeys: QueryKey[] = [];

    for (const meta of storedIndex) {
      // A write that landed while the index was loading is newer than the snapshot the store returned.
      if (index.has(meta.key)) continue;

      if (meta.version !== version || isExpired(meta, now)) {
        droppedKeys.push(meta.key);
      } else {
        index.set(meta.key, meta);
      }
    }

    try {
      // Nothing survived - the usual reason being a bumped `version`, i.e. a deploy whose response
      // shapes changed. Emptying the store outright also collects anything the index does not know
      // about, which a key-by-key removal cannot.
      if (droppedKeys.length && !index.size) {
        await enqueue(() => adapter.clear());
      } else if (droppedKeys.length) {
        await enqueue(() => removeKeys(droppedKeys));
      }

      // The cap is otherwise only applied by a write, so a store left over the limit - by a deploy
      // that lowered `maxEntries`, or by several tabs writing against their own index - would stay
      // that way until this session happens to write something.
      await enqueue(enforceMaxEntries);
    } catch {
      // Pruning is opportunistic: `maxAge` is re-checked before every hydration, so a failure here
      // costs disk space, never correctness.
    }
  };

  const start = async () => {
    if (!adapter.isSupported) {
      isReady = true;
      markReady();

      return;
    }

    const generation = storeGeneration;

    // An unreadable store is treated as an empty one rather than as a reason to give up on writing: the
    // write path has its own failure handling, and whatever broke here may not affect it.
    const storedIndex = await adapter.loadIndex().catch((): PersistedQueryEntryMeta[] => []);

    // A `clear()` that ran while the load was open already emptied the store, so this snapshot lists
    // bodies that no longer exist - adopting it would leave the index reporting entries forever.
    if (storeGeneration === generation) await adoptStoredIndex(storedIndex);

    isReady = true;
    markReady();

    if (isSecurePurgeDeferred) {
      isSecurePurgeDeferred = false;
      await purgeSecure().catch(() => undefined);
    }

    const queued = Array.from(pendingHydrations);
    pendingHydrations.clear();

    for (const key of queued) {
      void hydrate(key);
    }
  };

  const hydrate = async (key: QueryKey) => {
    const meta = index.get(key);

    if (!meta || isExpired(meta)) return;

    let stored: PersistedQueryBody | null;

    try {
      stored = await adapter.read(key);
    } catch {
      return;
    }

    if (!stored) {
      // The store disagrees with the index - another tab removed the entry in between. Believe the
      // store.
      index.delete(key);

      return;
    }

    // Removing beats writing on the read path too: a logout purge or a `clearPersistedQueries()` that
    // finished while this body was on its way up must not be undone by it.
    if (!index.has(key)) return;

    // Whether this still makes sense is the repository's call: it applies the body only while the
    // entry exists and has no response of its own yet, so a network response that won the race, a
    // sibling tab that got there first, and a destroyed query all end here harmlessly.
    repository.applyPersistedResponse({ key, body: stored.body, expiresAt: meta.expiresAt });
  };

  const runFlush = async () => {
    clearTimeout(writeTimer);
    writeTimer = undefined;

    await removeKeys([]).catch(() => undefined);

    if (!pendingWrites.size) return;

    const entries = Array.from(pendingWrites.values());
    pendingWrites.clear();

    if (areWritesDisabled) return;

    try {
      await adapter.write(entries);
    } catch {
      // The realistic failure is a full quota. Free the oldest half and give it exactly one more go -
      // repeated retries against a disk that is genuinely full would just burn transactions.
      try {
        const oldestHalf = Array.from(index.values())
          .sort((a, b) => a.persistedAt - b.persistedAt)
          .slice(0, Math.ceil(index.size / 2))
          .map((meta) => meta.key);

        await removeKeys(oldestHalf);
        await adapter.write(entries);
      } catch (error) {
        areWritesDisabled = true;

        if (isDevMode()) {
          console.warn(
            '[@ethlete/query] Persisting query responses failed twice and has been disabled for this session.',
            error,
          );
        }

        return;
      }
    }

    for (const entry of entries) {
      index.set(entry.key, metaOf(entry));
    }

    await enforceMaxEntries().catch(() => undefined);
  };

  const flush = () => enqueue(runFlush);

  const scheduleFlush = () => {
    if (writeTimer !== undefined || areWritesDisabled || isDestroyed) return;

    writeTimer = setTimeout(() => void flush(), writeDelay);
  };

  const queueWrite = (event: Extract<QueryRepositoryEvent, { type: 'request-success' }>) => {
    if (!adapter.isSupported || areWritesDisabled) return;

    // `subtle.useQueryRepositoryCache` lets a mutation (the auth queries) reach the cache; only a
    // refreshable read (a GET, or a GraphQL query sent via POST) may reach the store.
    if (!event.isRefreshable) return;

    const body = event.request.response();

    // Only data is worth persisting. A settle without a body (a 204, or a response type the request
    // never resolved) has nothing to hand back on a cold start.
    if (body === null || body === undefined) return;

    const candidate = {
      key: event.key,
      url: event.request.url,
      method: event.request.method,
      isSecure: event.isSecure,
    };

    if (config.filter && !config.filter(candidate)) return;

    pendingWrites.set(event.key, {
      ...candidate,
      body,
      expiresAt: event.request.expiresAt(),
      persistedAt: Date.now(),
      version,
    });

    scheduleFlush();
  };

  const handleEvent = (event: QueryRepositoryEvent) => {
    if (event.type === 'unbind-all-secure') {
      // A logout before the index has loaded still has to purge - the entries are on disk, this tab
      // simply does not know their keys yet.
      if (!isReady) {
        isSecurePurgeDeferred = true;
      } else {
        void purgeSecure().catch(() => undefined);
      }

      return;
    }

    if (event.type === 'entry-created') {
      if (!event.isCached || !event.isPersistEnabled) return;

      if (isReady) {
        void hydrate(event.key);
      } else {
        pendingHydrations.add(event.key);
      }

      return;
    }

    if (event.type === 'request-success' && event.isCached && event.isPersistEnabled) queueWrite(event);
  };

  const eventSubscription = repository.events$.subscribe(handleEvent);

  const clear = () => {
    clearTimeout(writeTimer);
    writeTimer = undefined;
    pendingWrites.clear();
    storeGeneration++;

    return enqueue(async () => {
      index.clear();

      await adapter.clear();

      // An empty store is the one thing that reliably answers the quota failure that stopped writing,
      // so the session gets its persistence back rather than waiting for a reload.
      areWritesDisabled = false;
    });
  };

  const destroy = () => {
    isDestroyed = true;
    eventSubscription.unsubscribe();
    clearTimeout(writeTimer);
    writeTimer = undefined;

    // Best effort: a client is usually destroyed because the app is going away, and whatever settled
    // in the last second is exactly what the next start would want.
    void flush();
  };

  void start();

  return {
    whenReady,
    flush,
    clear,
    indexEntries: () => Array.from(index.values()),
    destroy,
  };
};
