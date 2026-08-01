import type { QueryMethod } from '../query-creator';
import type { QueryKey } from '../query-repository';

/**
 * Schema version of the persisted store, owned by this library. Bumping it makes the storage adapter
 * throw away everything it holds and start over, which is the correct response to a change in the
 * *record* shape - an older record could not be read by the new code.
 *
 * This is not the version an app bumps when its *response* shapes change; that is
 * {@link QueryPersistenceConfig.version}, kept per entry so the engine can drop foreign entries
 * without wiping the store.
 */
export const QUERY_PERSISTENCE_STORE_VERSION = 1;

/**
 * Everything known about a persisted response except the response itself. Small enough that the
 * engine keeps all of it in memory for the whole session, which is what lets it decide staleness,
 * eviction order and the logout purge without reading a single body back.
 */
export type PersistedQueryEntryMeta = {
  /** The cache key the response belongs to - the same key every tab derives for that query. */
  key: QueryKey;

  /** When the entry was written, in ms. Drives {@link QueryPersistenceConfig.maxAge} and eviction order. */
  persistedAt: number;

  /**
   * Timestamp (ms) at which the response goes stale, or `null` when it has no freshness window.
   * Stored and restored verbatim: it is a server-derived instant, so a value from a previous session
   * is simply in the past. It never suppresses the request a hydrated entry makes - see
   * {@link QueryRepository.applyPersistedResponse}.
   */
  expiresAt: number | null;

  /**
   * Whether the entry belongs to a secure (authenticated) request. Tracked so a logout can purge
   * exactly those entries from disk at the moment the in-memory ones go.
   */
  isSecure: boolean;

  /** @see QueryPersistenceConfig.version */
  version: number;

  /** The full URL of the request, including query params. For the devtools and write-time filtering. */
  url: string;

  /** The HTTP method of the request. Always a cacheable read method. */
  method: QueryMethod;
};

/** A persisted response, ready to be written to (or as it came out of) the store. */
export type PersistedQueryEntry = PersistedQueryEntryMeta & {
  /** The raw response body, exactly as the request received it. */
  body: unknown;
};

/**
 * What a {@link QueryPersistenceAdapter.read} returns on a hit. Wrapped rather than returned bare so
 * a stored body that happens to be `null` cannot be mistaken for a miss.
 */
export type PersistedQueryBody = {
  body: unknown;
};
