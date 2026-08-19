import { QueryDevtoolsEntry } from './query-devtools-hook';

/**
 * How many destroyed queries the registry keeps. A tombstone holds the last response body it captured,
 * so the list is capped for the same reason the repository caps its unused entries.
 */
export const MAX_QUERY_DEVTOOLS_TOMBSTONES = 50;

/**
 * How many of its settled items' queries one batch keeps. Counted per batch rather than against
 * {@link MAX_QUERY_DEVTOOLS_TOMBSTONES}, so a bulk run cannot evict the tombstones the panel is read
 * for - and low, because the batch's own entry already holds every item's args, response and error.
 */
export const MAX_QUERY_BATCH_TOMBSTONES = 20;

const frozen =
  <T>(value: T) =>
  () =>
    value;

const noop = () => undefined;

/**
 * Reads one signal off a handle that is being destroyed. A query whose injector is already gone can
 * throw here, and losing one field is better than losing the whole tombstone.
 */
const read = <T>(get: () => T, fallback: T): T => {
  try {
    return get();
  } catch {
    return fallback;
  }
};

type LiveRequest = {
  method: string;
  url: string;
  args: unknown;
  loading: () => unknown;
  error: () => unknown;
  response: () => unknown;
  currentEvent: () => unknown;
  expiresAt: () => number | null;
  subtle: {
    retryState: () => unknown;
    attempts: () => number;
    lastDurationMs: () => number | null;
    resolveHeaders: () => unknown;
    lastSentHeaders: () => unknown;
    lastPersistedResponseAt: () => number | null;
    lastExternalResponseAt: () => number | null;
  };
};

type LiveQuery = {
  id: () => string | null;
  args: () => unknown;
  response: () => unknown;
  error: () => unknown;
  latestHttpEvent: () => unknown;
  loading: () => unknown;
  lastTimeExecutedAt: () => number | null;
  triggeredBy: () => string | null;
  executionState: () => unknown;
  subtle: { request: () => LiveRequest | null };
};

/**
 * A destroyed query's last state, shaped like the query itself: every signal the panel reads is
 * replaced by a function returning the value it held when the query went away, and every action is a
 * no-op. Rendering a tombstone therefore costs the panel no second code path - the drawer reads
 * `entry.handle` exactly as it does for a live query, and gates its actions on
 * {@link QueryDevtoolsEntry.destroyedAt} instead.
 *
 * The captured request is a plain copy, not the request itself: the real one is destroyed the moment
 * its cache entry is, and holding it would keep its subscriptions and its cache entry alive.
 */
export const snapshotQueryDevtoolsHandle = (handle: unknown): unknown => {
  const query = handle as LiveQuery | null;

  if (!query || typeof query !== 'object') return handle;

  const live = read(() => query.subtle?.request() ?? null, null);

  const request = live
    ? {
        method: live.method,
        url: live.url,
        args: live.args,
        execute: () => false,
        destroy: () => false,
        isStale: frozen(false),
        loading: frozen(null),
        error: read(() => frozen(live.error()), frozen(null)),
        response: read(() => frozen(live.response()), frozen(null)),
        currentEvent: read(() => frozen(live.currentEvent()), frozen(null)),
        expiresAt: read(() => frozen(live.expiresAt()), frozen(null)),
        subtle: {
          retryState: frozen(null),
          attempts: read(() => frozen(live.subtle.attempts()), frozen(1)),
          lastDurationMs: read(() => frozen(live.subtle.lastDurationMs()), frozen(null)),
          resolveHeaders: read(() => frozen(live.subtle.resolveHeaders()), frozen(undefined)),
          lastSentHeaders: read(() => frozen(live.subtle.lastSentHeaders()), frozen(undefined)),
          lastPersistedResponseAt: read(() => frozen(live.subtle.lastPersistedResponseAt()), frozen(null)),
          lastExternalResponseAt: read(() => frozen(live.subtle.lastExternalResponseAt()), frozen(null)),
        },
      }
    : null;

  return {
    id: read(() => frozen(query.id()), frozen(null)),
    args: read(() => frozen(query.args()), frozen(null)),
    response: read(() => frozen(query.response()), frozen(null)),
    error: read(() => frozen(query.error()), frozen(null)),
    latestHttpEvent: read(() => frozen(query.latestHttpEvent()), frozen(null)),
    lastTimeExecutedAt: read(() => frozen(query.lastTimeExecutedAt()), frozen(null)),
    triggeredBy: read(() => frozen(query.triggeredBy()), frozen(null)),
    executionState: read(() => frozen(query.executionState()), frozen(null)),
    // A tombstone never loads: a forced loading state captured mid-flight would spin forever.
    loading: frozen(null),
    execute: () => false,
    reset: noop,
    subtle: {
      request: frozen(request),
      destroy: noop,
      setResponse: noop,
      setLoading: noop,
      setError: noop,
    },
  };
};

/**
 * The entry a destroyed query leaves behind: the same id, kind and metadata, a frozen
 * {@link snapshotQueryDevtoolsHandle} in place of the live query, and no `element` - a DOM node whose
 * component is gone must not be kept alive by the panel.
 *
 * `stats` is carried over as-is. The recorder closes over its own signals rather than over the query,
 * so the run history that makes a failed request readable survives without retaining anything.
 */
export const tombstoneOf = (entry: QueryDevtoolsEntry, destroyedAt: number): QueryDevtoolsEntry => {
  const { element: _element, ...meta } = entry.meta;

  return {
    id: entry.id,
    kind: entry.kind,
    meta,
    handle: snapshotQueryDevtoolsHandle(entry.handle),
    createdAt: entry.createdAt,
    destroyedAt,
    stats: entry.stats,
  };
};
