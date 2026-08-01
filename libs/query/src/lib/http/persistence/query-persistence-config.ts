import type { QueryMethod } from '../query-creator';
import type { QueryKey } from '../query-repository';
import type { QueryPersistenceAdapter } from './query-persistence-adapter';

/** A response that is about to be written to disk, as seen by {@link QueryPersistenceConfig.filter}. */
export type QueryPersistenceCandidate = {
  /** The cache key the response is held under. */
  key: QueryKey;

  /** The full URL of the request, including query params. */
  url: string;

  /** The HTTP method. Always a cacheable read method. */
  method: QueryMethod;

  /** Whether the response belongs to a secure (authenticated) request. */
  isSecure: boolean;
};

/**
 * Keeps a query client's successful reads on disk, so a reload - or a cold start without a network -
 * renders the last known data instead of a loading state.
 *
 * @see withQueryPersistence
 */
export type QueryPersistenceConfig = {
  /**
   * The name of the underlying store (an IndexedDB database, by default). One per client, so two
   * clients never overwrite each other's entries.
   *
   * @default `et-query-persistence-${client name}`
   */
  storageName?: string;

  /**
   * The version of the *response shapes* this app persists. Every entry is written under it, and an
   * entry written under a different one is dropped rather than hydrated.
   *
   * Bump it in the same commit that changes what a response looks like - a renamed field, a different
   * pagination envelope - so a returning user's disk copy cannot be handed to code that no longer
   * understands it. Rolling back works too: the old build ignores what the new one wrote.
   *
   * @default 1
   */
  version?: number;

  /**
   * How old (in ms) a persisted response may be and still be shown. Anything older is dropped at
   * startup and never hydrated.
   *
   * This is the only bound on how stale the *first paint* after a cold start can be, and it is
   * independent of both server freshness (`cacheAdapter` / `expiresAt`, which decides whether a read
   * may skip the network) and {@link CreateQueryClientConfigOptions.keepUnusedFor} (which is about
   * memory within one session). A hydrated response is always revalidated, so this is about how
   * plausible the data has to be to be worth showing at all.
   *
   * @default 86400000 (24 hours)
   */
  maxAge?: number;

  /**
   * How many responses may be kept at once. When a write pushes the store over the cap, the least
   * recently written entries are removed until it fits.
   *
   * Keeps a query whose cache key changes constantly - search-as-you-type produces one per keystroke -
   * from filling the user's disk with results nobody will ask for again.
   *
   * @default 50
   */
  maxEntries?: number;

  /**
   * How long (in ms) writes are collected before being flushed in one batch. A query polled every
   * second must not mean a store transaction every second; only the newest body per key is written.
   *
   * Pending writes are always flushed immediately when the tab is hidden or unloaded, so a reload
   * right after a fetch still finds the data regardless of this.
   *
   * @default 1000
   */
  writeDelay?: number;

  /**
   * Where to store responses. Defaults to IndexedDB
   * ({@link createIndexedDbQueryPersistenceAdapter}); supply your own to store them somewhere else.
   * Passed as a function, it is only called in a browser.
   */
  adapter?: QueryPersistenceAdapter | (() => QueryPersistenceAdapter);

  /**
   * Narrows what may be written, on top of the per-query
   * {@link BaseQueryCreatorOptions.persistence} flag. Returning `false` keeps that response
   * memory-only.
   *
   * @example
   * // Never persist anything under /admin, wherever it is queried from.
   * filter: ({ url }) => !new URL(url).pathname.startsWith('/admin')
   */
  filter?: (candidate: QueryPersistenceCandidate) => boolean;
};

/** @see QueryPersistenceConfig.maxAge */
export const DEFAULT_QUERY_PERSISTENCE_MAX_AGE = 86_400_000;

/** @see QueryPersistenceConfig.maxEntries */
export const DEFAULT_QUERY_PERSISTENCE_MAX_ENTRIES = 50;

/** @see QueryPersistenceConfig.writeDelay */
export const DEFAULT_QUERY_PERSISTENCE_WRITE_DELAY = 1000;

/** @see QueryPersistenceConfig.version */
export const DEFAULT_QUERY_PERSISTENCE_VERSION = 1;
