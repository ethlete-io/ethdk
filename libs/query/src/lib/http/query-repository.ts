import { randomId } from '@ethlete/core';
import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { DestroyRef, ErrorHandler, Injector, Signal, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { buildRoute } from './internal/request-route';
import { createHttpRequest, HttpRequest } from './http-request';
import { QueryArgs, RequestArgs } from './query';
import { buildQueryCacheKey, shouldCacheQuery } from './query-cache-utils';
import { CreateQueryClientConfigOptions } from './query-client';
import { CreateQueryCreatorOptions, QueryMethod, RouteType } from './query-creator';
import { uncacheableRequestHasAllowCacheParam, uncacheableRequestHasCacheKeyParam } from './query-errors';
import { RunQueryExecuteOptions } from './query-execute-utils';
import { ShouldRetryRequestFn } from './query-retry-utils';

export type QueryRepositoryEvent =
  | {
      type: 'request-error';
      error: HttpErrorResponse;
      key: QueryKey;
      isSecure: boolean;
      request: HttpRequest<QueryArgs>;
    }
  | {
      type: 'request-success';
      key: QueryKey;
      isSecure: boolean;
      request: HttpRequest<QueryArgs>;

      /**
       * Whether the request is held in the cache under a key every tab derives identically (a hash of
       * route + args) rather than a per-request UUID. `false` for mutations and anything else
       * uncacheable - which is exactly what tells the multi-tab sync engine whether a settled request
       * is a shareable read or a mutation other tabs should react to.
       */
      isCached: boolean;

      /** @see BaseQueryCreatorOptions.multiTabSync */
      isMultiTabSyncEnabled: boolean;

      /**
       * Whether this response may be written to the client's persisted store. Already accounts for
       * secure requests needing an explicit opt-in.
       *
       * @see BaseQueryCreatorOptions.persistence
       */
      isPersistEnabled: boolean;
    }
  | {
      /**
       * A cache entry was created - the query behind it had nothing to bind to, so this is the moment a
       * response from a previous session can still be of use. The persistence engine answers it by
       * reading the key back from disk.
       *
       * Only ever emitted for entries that did not exist before; a consumer binding to an entry that is
       * already there is not one of these.
       */
      type: 'entry-created';

      key: QueryKey;

      /** @see QueryRepositoryEvent.isCached */
      isCached: boolean;

      /** @see QueryRepositoryEvent.isPersistEnabled */
      isPersistEnabled: boolean;
    }
  | {
      /**
       * Every secure entry was torn down at once - a logout. Emitted after the cache is cleared so
       * secure queries can drop the state they hold themselves; the repository only owns the
       * requests, not the `response` signal of the query objects bound to them.
       */
      type: 'unbind-all-secure';
    };

export type QueryRepositoryRequestOptions<TArgs extends QueryArgs> = {
  /**
   * The route of the request.
   * @example '/users'
   * @example (args) => `/users/${args.userId}`
   */
  route: RouteType<TArgs>;

  /** The HTTP method of the request */
  method: QueryMethod;

  /** If the request is secure (needs authentication) */
  isSecure?: boolean;

  /** The data of the request */
  args?: RequestArgs<TArgs> | null;

  /** The query creator options of the request */
  creatorOptions?: CreateQueryCreatorOptions;

  /** Custom retry function for this specific request */
  retryFn?: ShouldRetryRequestFn;

  /** If set, this request's cache key will be prefixed with this key */
  key?: string;

  /** The previous tracking key of the request */
  previousKey?: QueryKey | null;

  /** The destroy ref to bind the request to. If the destroy ref is destroyed, the request will be destroyed as well. */
  consumerDestroyRef: DestroyRef;

  /** Configuration on how to run the query */
  runQueryOptions?: RunQueryExecuteOptions;

  /** @see QueryConfig.silenceUncacheableAllowCacheError */
  silenceUncacheableAllowCacheError?: boolean;
};

export type QueryRepositoryItem<TArgs extends QueryArgs> = {
  /** The key of the request (either a cache key for cacheable requests or a UUID for uncacheable requests) */
  key: QueryKey;

  /** The request object */
  request: HttpRequest<TArgs>;

  /**
   * Whether this call started a network request. `false` when a fresh cache entry answered it, or when
   * an identical request was already in flight - the consumer is bound to that request either way and
   * still gets its response.
   */
  executed: boolean;
};

/**
 * A read-only snapshot of a single cache entry, exposed via {@link QueryRepositorySubtle.cacheEntries}
 * for devtools inspection. The raw cache `Map` is never exposed.
 */
export type QueryRepositoryCacheEntry = {
  /** The cache key of the entry. */
  key: QueryKey;

  /** Whether the entry belongs to a secure (authenticated) request. */
  isSecure: boolean;

  /** How many consumers currently hold a binding to the entry. */
  consumerCount: number;

  /**
   * Whether the entry has no consumers left and is only being kept around for its
   * `keepUnusedFor` window. Such an entry is not a leak - it is waiting to be reused by a
   * consumer that comes back.
   */
  isUnused: boolean;

  /** The underlying HTTP request. */
  request: HttpRequest<QueryArgs>;
};

/**
 * Advanced repository internals used by the query devtools. **Not part of the general public
 * contract** - do not build application logic on top of these.
 */
export type QueryRepositorySubtle = {
  /** Returns a read-only snapshot of every entry currently held in the cache. */
  cacheEntries: () => QueryRepositoryCacheEntry[];

  /** A version counter bumped whenever the cache changes (bind / unbind / unbindAllSecure). */
  cacheVersion: Signal<number>;

  /**
   * Destroys and removes a single cache entry by key, regardless of its consumers. Intended for
   * devtools cache management - consumers still holding the query will get a fresh request on their
   * next execution.
   */
  evict: (key: QueryKey) => void;
};

/**
 * Narrows which in-use entries a {@link QueryRepository.refreshInUse} call refreshes. Returning
 * `false` leaves the entry alone.
 */
export type QueryRepositoryRefreshFilterFn = (request: HttpRequest<QueryArgs>) => boolean;

/** @see QueryRepository.applyExternalResponse */
export type ApplyExternalResponseOptions = {
  /** The cache key the response belongs to. */
  key: QueryKey;

  /** The response body, as received from the other tab. */
  body: unknown;

  /** Timestamp (ms) at which the response goes stale, or `null` when it has no freshness window. */
  expiresAt: number | null;
};

/** @see QueryRepository.applyPersistedResponse */
export type ApplyPersistedResponseOptions = {
  /** The cache key the response belongs to. */
  key: QueryKey;

  /** The response body, as it was read back from the store. */
  body: unknown;

  /**
   * Timestamp (ms) at which the response goes stale, as it was when the response was persisted - so
   * usually in the past, which is exactly right: the entry revalidates and the data is shown meanwhile.
   */
  expiresAt: number | null;
};

/**
 * The query repository is responsible for managing all requests and their consumers.
 * It will cache requests if they can be cached and reuse them if they are already cached.
 * It will also destroy requests if there are no more consumers left.
 */
export type QueryRepository = {
  /** Creates a new request. If the request is already cached, it will be reused. */
  request: <TArgs extends QueryArgs>(options: QueryRepositoryRequestOptions<TArgs>) => QueryRepositoryItem<TArgs>;

  /** Removes a consumer from a request by its key. Destroys the request if there are no more consumers left. */
  unbind: (key: QueryKey | null, consumerDestroyRef: DestroyRef) => boolean;

  /** Removes all secure requests and their consumers */
  unbindAllSecure: () => void;

  /**
   * Re-executes every cacheable entry that still has consumers, bypassing the cache and restarting
   * in-flight requests. Entries kept only for their `keepUnusedFor` window are skipped - nobody is
   * looking at them, and they revalidate on their own when a consumer binds again.
   *
   * Pass a filter to narrow it down to a subset of those entries.
   *
   * @see QueryClient.refreshQueriesInUse
   */
  refreshInUse: (filter?: QueryRepositoryRefreshFilterFn) => void;

  /**
   * Writes a response that another tab received onto the matching cache entry, so the same query
   * shows the same data everywhere without a second network request.
   *
   * Returns whether it was applied. It is skipped when
   * - no entry exists for the key: cold entries are never seeded on speculation, that would be
   *   unbounded memory for data nobody in this tab is looking at,
   * - the entry's creator opted out of {@link BaseQueryCreatorOptions.multiTabSync},
   * - or the entry has a request in flight, which is at least as fresh and overwrites this anyway.
   *
   * Entries sitting out their `keepUnusedFor` window without consumers *are* updated - it costs
   * nothing and means a returning consumer renders data that is current rather than merely recent.
   */
  applyExternalResponse: (options: ApplyExternalResponseOptions) => boolean;

  /**
   * Writes a response from a previous session - read back from the client's persisted store - onto a
   * cache entry that has nothing of its own yet.
   *
   * Returns whether it was applied. It is skipped when
   * - no entry exists for the key: the entry was destroyed again while the store was being read,
   * - the entry's creator opted out of {@link BaseQueryCreatorOptions.persistence},
   * - or the entry already holds a response - from its own request, or from another tab. Persisted data
   *   only ever fills a gap; it never replaces something newer.
   *
   * Note that the entry's request is *not* stopped: hydration happens while it is already in flight, so
   * persisted data is always shown alongside a revalidation rather than instead of one. An entry whose
   * request already failed keeps its error, which is what makes the offline case honest - the data is
   * from disk, and the attempt to refresh it did fail.
   */
  applyPersistedResponse: (options: ApplyPersistedResponseOptions) => boolean;

  /** Observable stream of repository events (errors, successes, etc.) */
  events$: Observable<QueryRepositoryEvent>;

  /** Advanced repository internals used by the query devtools. */
  subtle: QueryRepositorySubtle;
};

/** The key of a query (either a cache key for cacheable requests or a UUID for uncacheable requests) */
export type QueryKey = string;

/** Runs .unbind() if the DestroyRef.onDestroy() gets called */
export type DestroyCleanupCallback = () => void;

/**
 * Keeps track of all places where the request gets used. Once the last consumer is gone the entry is
 * either destroyed right away or kept for `keepUnusedFor` milliseconds so a consumer that comes back
 * (e.g. via browser back navigation) finds its data already there.
 */
type DestroyListenerMapItem = {
  consumers: Map<DestroyRef, DestroyCleanupCallback>;
  request: HttpRequest<QueryArgs>;
  isSecure: boolean;
  eventSubscription?: { unsubscribe: () => void };

  /** Whether the entry lives under a cache key other tabs derive identically. */
  isCached: boolean;

  /** @see BaseQueryCreatorOptions.multiTabSync */
  isMultiTabSyncEnabled: boolean;

  /** @see QueryRepositoryEvent.isPersistEnabled */
  isPersistEnabled: boolean;

  /** How long this entry survives without consumers. `0` destroys it immediately. */
  keepUnusedFor: number;

  /** When the entry lost its last consumer - drives the eviction order of the unused-entry cap. */
  unusedSince?: number;

  /** Pending eviction of an unused entry, cancelled as soon as a consumer binds again. */
  evictTimer?: ReturnType<typeof setTimeout>;
};

type BindEntryOptions = {
  key: QueryKey;
  consumerDestroyRef: DestroyRef;
  request: HttpRequest<QueryArgs>;
  isSecure: boolean;

  /**
   * Whether the entry may be shared with other consumers of the same key. Uncacheable requests get a
   * per-request UUID key and are never reused.
   */
  isCached: boolean;

  isMultiTabSyncEnabled: boolean;
  isPersistEnabled: boolean;
  keepUnusedFor: number;
};

export type QueryRepositoryDependencies = {
  /** The HTTP client to use for the requests */
  httpClient: HttpClient;

  /** The error handler to use for the requests */
  ngErrorHandler: ErrorHandler;

  /** The injector to use for reactive operations like signal->observable conversions */
  injector: Injector;
};

export type CreateQueryRepositoryConfig = CreateQueryClientConfigOptions & {
  /** The dependencies of the query repository */
  dependencies: QueryRepositoryDependencies;

  /**
   * Whether unused entries may be retained at all. `false` forces `keepUnusedFor` to `0` everywhere,
   * regardless of client or creator configuration - used to disable retention on the server, where a
   * per-request injector must not hold response bodies (and a pending timer) for minutes.
   * @default true
   */
  retentionEnabled?: boolean;
};

const generateUuid = () => randomId();

/** @see CreateQueryClientConfigOptions.keepUnusedFor */
export const DEFAULT_KEEP_UNUSED_FOR = 300_000;

/**
 * Hard cap on entries kept without consumers, per client. Retention is opportunistic, so a runaway
 * count (a search-as-you-type query produces a new cache key per keystroke, and each one goes through
 * `unbind`) must never grow unbounded - the least recently orphaned entries are dropped first.
 */
export const MAX_UNUSED_ENTRIES = 50;

export const createQueryRepository = (config: CreateQueryRepositoryConfig): QueryRepository => {
  const cache = new Map<QueryKey, DestroyListenerMapItem>();
  const eventsSubject = new Subject<QueryRepositoryEvent>();

  // Bumped on every cache mutation so the devtools cache view can react. Cheap enough to keep
  // unconditional - it is a single integer signal with no readers unless the devtools are open.
  const cacheVersion = signal(0);
  const bumpCacheVersion = () => cacheVersion.update((v) => v + 1);

  const resolveKeepUnusedFor = (creatorOptions: CreateQueryCreatorOptions | undefined, shouldCache: boolean) => {
    if (config.retentionEnabled === false || !shouldCache) return 0;

    return Math.max(0, creatorOptions?.keepUnusedFor ?? config.keepUnusedFor ?? DEFAULT_KEEP_UNUSED_FOR);
  };

  const request = <TArgs extends QueryArgs>(options: QueryRepositoryRequestOptions<TArgs>) => {
    const { args, creatorOptions, runQueryOptions } = options;
    const shouldCache =
      creatorOptions?.subtle?.useQueryRepositoryCache === false
        ? false
        : shouldCacheQuery(options.method) || creatorOptions?.subtle?.useQueryRepositoryCache === true;

    if (!shouldCache && options.key) throw uncacheableRequestHasCacheKeyParam(options.key);

    // `allowCache` is never read on the uncacheable path below - there is no cache entry to reuse - so this throw
    // is purely a guard against a mistake in hand-written code. The legacy interop opts out of it.
    if (!shouldCache && runQueryOptions?.allowCache && !options.silenceUncacheableAllowCacheError) {
      throw uncacheableRequestHasAllowCacheParam();
    }

    const route = buildRoute({
      base: config.baseUrl,
      route: options.route,
      pathParams: args?.pathParams,
      queryParams: args?.queryParams,
      queryParamConfig: config.queryString,
    });

    const cacheKey = shouldCache
      ? buildQueryCacheKey(`${options.key ? options.key + '_' : ''}${route}`, {
          body: args?.body,
          queryParams: args?.queryParams,
          pathParams: args?.pathParams,
          headers: args?.headers,
        })
      : false;

    const trackingKey = cacheKey || generateUuid();
    const keepUnusedFor = resolveKeepUnusedFor(creatorOptions, shouldCache);
    const isMultiTabSyncEnabled = creatorOptions?.multiTabSync !== false;
    const isSecure = options.isSecure ?? false;

    // A secure response needs an explicit `persistence: true` to reach the disk: leaving an
    // authenticated user's data there is a decision per endpoint, not a default. Everything else
    // persists unless it opted out.
    const isPersistEnabled =
      creatorOptions?.persistence === true || (creatorOptions?.persistence !== false && !isSecure);

    const previousKey = options.previousKey;

    if (cacheKey !== previousKey && previousKey) {
      unbind(previousKey, options.consumerDestroyRef);
    }

    if (shouldCache && cacheKey) {
      const cacheEntry = cache.get(cacheKey);

      if (cacheEntry) {
        // The entry may have been sitting out its `keepUnusedFor` window - a consumer binding again
        // makes it live, so the pending eviction must go.
        cancelEviction(cacheEntry);

        bind({
          key: cacheKey,
          consumerDestroyRef: options.consumerDestroyRef,
          request: cacheEntry.request,
          isSecure,
          isCached: true,
          isMultiTabSyncEnabled,
          isPersistEnabled,
          keepUnusedFor,
        });

        const executed =
          !runQueryOptions?.allowCache || cacheEntry.request.isStale()
            ? cacheEntry.request.execute({ allowCache: runQueryOptions?.allowCache })
            : false;

        return { key: cacheKey, request: cacheEntry.request as HttpRequest<TArgs>, executed };
      }
    }

    const request = createHttpRequest<TArgs>({
      fullPath: route,
      args,
      method: options.method,
      dependencies: config.dependencies,
      clientOptions: creatorOptions,
      clientHeaders: config.headers,
      cacheAdapter: config.cacheAdapter,
      retryFn: options.retryFn ?? config.retryFn,
    });

    const executed = request.execute();

    bind({
      key: trackingKey,
      consumerDestroyRef: options.consumerDestroyRef,
      request,
      isSecure,
      isCached: shouldCache,
      isMultiTabSyncEnabled,
      isPersistEnabled,
      keepUnusedFor,
    });

    // Announced after the entry is bound and its request is on its way, because the one thing that acts
    // on it - hydration from the persisted store - is only ever allowed to fill a gap this request has
    // not filled itself.
    eventsSubject.next({ type: 'entry-created', key: trackingKey, isCached: shouldCache, isPersistEnabled });

    return { key: trackingKey, request, executed };
  };

  /** Tears an entry down for good, whether it currently has consumers or not. */
  const destroyEntry = (key: QueryKey, cacheEntry: DestroyListenerMapItem) => {
    clearTimeout(cacheEntry.evictTimer);
    cacheEntry.request.destroy();
    cacheEntry.eventSubscription?.unsubscribe();
    cache.delete(key);
  };

  const cancelEviction = (cacheEntry: DestroyListenerMapItem) => {
    if (cacheEntry.evictTimer === undefined) return;

    clearTimeout(cacheEntry.evictTimer);
    cacheEntry.evictTimer = undefined;
    cacheEntry.unusedSince = undefined;
  };

  /** Drops the least recently orphaned unused entries until the cap is respected again. */
  const enforceUnusedEntryLimit = () => {
    const unused = Array.from(cache.entries()).filter(([, entry]) => entry.consumers.size === 0);

    if (unused.length <= MAX_UNUSED_ENTRIES) return;

    unused.sort(([, a], [, b]) => (a.unusedSince ?? 0) - (b.unusedSince ?? 0));

    for (const [key, entry] of unused.slice(0, unused.length - MAX_UNUSED_ENTRIES)) {
      destroyEntry(key, entry);
    }
  };

  const retain = (key: QueryKey, cacheEntry: DestroyListenerMapItem) => {
    cacheEntry.unusedSince = Date.now();
    cacheEntry.evictTimer = setTimeout(() => evict(key), cacheEntry.keepUnusedFor);

    enforceUnusedEntryLimit();
  };

  const unbind = (key: QueryKey | null, consumerDestroyRef: DestroyRef) => {
    if (key === null) return false;

    const cacheEntry = cache.get(key);

    if (!cacheEntry) return false;

    cacheEntry.consumers.delete(consumerDestroyRef);

    if (cacheEntry.consumers.size === 0) {
      // Only data is worth keeping around: an entry that never produced a response has nothing to
      // hand back to a returning consumer, so it is aborted immediately as it always was.
      if (cacheEntry.keepUnusedFor > 0 && cacheEntry.request.response() !== null) {
        retain(key, cacheEntry);
      } else {
        destroyEntry(key, cacheEntry);
      }
    }

    bumpCacheVersion();

    return true;
  };

  const unbindAllSecure = () => {
    for (const [key, cacheEntry] of cache.entries()) {
      if (!cacheEntry.isSecure) continue;

      // Force the teardown instead of routing through `unbind`: a logged out session must not leave a
      // retained response body behind waiting out its `keepUnusedFor` window.
      cacheEntry.consumers.clear();
      destroyEntry(key, cacheEntry);
    }

    bumpCacheVersion();
    eventsSubject.next({ type: 'unbind-all-secure' });
  };

  const refreshInUse = (filter?: QueryRepositoryRefreshFilterFn) => {
    for (const cacheEntry of cache.values()) {
      if (cacheEntry.consumers.size === 0) continue;

      // Re-firing a mutation would be a side effect nobody asked for, so only reads are refreshed -
      // "read" meaning cacheable, which also covers a GQL query transported via POST that opted into
      // the cache explicitly.
      if (!cacheEntry.isCached) continue;

      if (filter && !filter(cacheEntry.request)) continue;

      cacheEntry.request.execute({ force: true });
    }
  };

  const applyExternalResponse = (options: ApplyExternalResponseOptions) => {
    const cacheEntry = cache.get(options.key);

    if (!cacheEntry || !cacheEntry.isMultiTabSyncEnabled) return false;

    if (cacheEntry.request.loading()) return false;

    cacheEntry.request.subtle.applyExternalResponse({ body: options.body, expiresAt: options.expiresAt });

    return true;
  };

  const applyPersistedResponse = (options: ApplyPersistedResponseOptions) => {
    const cacheEntry = cache.get(options.key);

    if (!cacheEntry || !cacheEntry.isPersistEnabled) return false;

    // The store is read asynchronously, so by now the request may well have settled, or another tab may
    // have fed the entry. Either way what is here is newer than what was on disk.
    if (cacheEntry.request.response() !== null) return false;

    cacheEntry.request.subtle.applyPersistedResponse({ body: options.body, expiresAt: options.expiresAt });

    return true;
  };

  const bind = (options: BindEntryOptions) => {
    const {
      key,
      consumerDestroyRef,
      request,
      isSecure,
      isCached,
      isMultiTabSyncEnabled,
      isPersistEnabled,
      keepUnusedFor,
    } = options;

    const destroyListener = consumerDestroyRef.onDestroy(() => unbind(key, consumerDestroyRef));

    const cacheEntry = cache.get(key);

    if (cacheEntry && isCached) {
      cacheEntry.consumers.set(consumerDestroyRef, destroyListener);
    } else {
      const consumers: Map<DestroyRef, DestroyCleanupCallback> = new Map([]);

      consumers.set(consumerDestroyRef, destroyListener);

      // Drive repository events off the request's discrete, terminal event stream rather than
      // recombining the `error` + `response` signals via combineLatest (which could observe stale
      // pairings). Each settle emits exactly one terminal event.
      const eventSubscription = request.events$.subscribe((event) => {
        if (event.type === 'error') {
          if (event.error.raw instanceof HttpErrorResponse) {
            eventsSubject.next({ type: 'request-error', error: event.error.raw, key, isSecure, request });
          }
        } else if (event.type === HttpEventType.Response) {
          eventsSubject.next({
            type: 'request-success',
            key,
            isSecure,
            request,
            isCached,
            isMultiTabSyncEnabled,
            isPersistEnabled,
          });
        }
      });

      cache.set(key, {
        consumers,
        request,
        isSecure,
        eventSubscription,
        keepUnusedFor,
        isCached,
        isMultiTabSyncEnabled,
        isPersistEnabled,
      });
    }

    bumpCacheVersion();
  };

  const cacheEntries = (): QueryRepositoryCacheEntry[] =>
    Array.from(cache.entries()).map(([key, entry]) => ({
      key,
      isSecure: entry.isSecure,
      consumerCount: entry.consumers.size,
      isUnused: entry.consumers.size === 0,
      request: entry.request,
    }));

  const evict = (key: QueryKey) => {
    const entry = cache.get(key);

    if (!entry) return;

    destroyEntry(key, entry);
    bumpCacheVersion();
  };

  const repository: QueryRepository = {
    request,
    unbind,
    unbindAllSecure,
    refreshInUse,
    applyExternalResponse,
    applyPersistedResponse,
    events$: eventsSubject.asObservable(),
    subtle: {
      cacheEntries,
      cacheVersion: cacheVersion.asReadonly(),
      evict,
    },
  };

  return repository;
};
