import { randomId } from '@ethlete/core';
import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { DestroyRef, ErrorHandler, Injector, Signal, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { buildRoute } from '../legacy';
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
    }
  | {
      /**
       * Every secure entry was torn down at once — a logout. Emitted after the cache is cleared so
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
};

export type QueryRepositoryItem<TArgs extends QueryArgs> = {
  /** The key of the request (either a cache key for cacheable requests or a UUID for uncacheable requests) */
  key: QueryKey;

  /** The request object */
  request: HttpRequest<TArgs>;
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
   * `keepUnusedFor` window. Such an entry is not a leak — it is waiting to be reused by a
   * consumer that comes back.
   */
  isUnused: boolean;

  /** The underlying HTTP request. */
  request: HttpRequest<QueryArgs>;
};

/**
 * Advanced repository internals used by the query devtools. **Not part of the general public
 * contract** — do not build application logic on top of these.
 */
export type QueryRepositorySubtle = {
  /** Returns a read-only snapshot of every entry currently held in the cache. */
  cacheEntries: () => QueryRepositoryCacheEntry[];

  /** A version counter bumped whenever the cache changes (bind / unbind / unbindAllSecure). */
  cacheVersion: Signal<number>;

  /**
   * Destroys and removes a single cache entry by key, regardless of its consumers. Intended for
   * devtools cache management — consumers still holding the query will get a fresh request on their
   * next execution.
   */
  evict: (key: QueryKey) => void;
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
   * in-flight requests. Entries kept only for their `keepUnusedFor` window are skipped — nobody is
   * looking at them, and they revalidate on their own when a consumer binds again.
   *
   * @see QueryClient.refreshQueriesInUse
   */
  refreshInUse: () => void;

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

  /** How long this entry survives without consumers. `0` destroys it immediately. */
  keepUnusedFor: number;

  /** When the entry lost its last consumer — drives the eviction order of the unused-entry cap. */
  unusedSince?: number;

  /** Pending eviction of an unused entry, cancelled as soon as a consumer binds again. */
  evictTimer?: ReturnType<typeof setTimeout>;
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
   * regardless of client or creator configuration — used to disable retention on the server, where a
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
 * `unbind`) must never grow unbounded — the least recently orphaned entries are dropped first.
 */
export const MAX_UNUSED_ENTRIES = 50;

export const createQueryRepository = (config: CreateQueryRepositoryConfig): QueryRepository => {
  const cache = new Map<QueryKey, DestroyListenerMapItem>();
  const eventsSubject = new Subject<QueryRepositoryEvent>();

  // Bumped on every cache mutation so the devtools cache view can react. Cheap enough to keep
  // unconditional — it is a single integer signal with no readers unless the devtools are open.
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
    if (!shouldCache && runQueryOptions?.allowCache) throw uncacheableRequestHasAllowCacheParam();

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

    const previousKey = options.previousKey;

    if (cacheKey !== previousKey && previousKey) {
      unbind(previousKey, options.consumerDestroyRef);
    }

    if (shouldCache && cacheKey) {
      const cacheEntry = cache.get(cacheKey);

      if (cacheEntry) {
        // The entry may have been sitting out its `keepUnusedFor` window — a consumer binding again
        // makes it live, so the pending eviction must go.
        cancelEviction(cacheEntry);

        bind(cacheKey, options.consumerDestroyRef, cacheEntry.request, options.isSecure ?? false, true, keepUnusedFor);

        if (!runQueryOptions?.allowCache || cacheEntry.request.isStale()) {
          cacheEntry.request.execute({ allowCache: runQueryOptions?.allowCache });
        }

        return { key: cacheKey, request: cacheEntry.request as HttpRequest<TArgs> };
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

    request.execute();

    bind(trackingKey, options.consumerDestroyRef, request, options.isSecure ?? false, shouldCache, keepUnusedFor);

    return { key: trackingKey, request };
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

  const refreshInUse = () => {
    for (const cacheEntry of cache.values()) {
      if (cacheEntry.consumers.size === 0) continue;

      // Re-firing a mutation would be a side effect nobody asked for, so only reads are refreshed.
      if (!shouldCacheQuery(cacheEntry.request.method)) continue;

      cacheEntry.request.execute({ force: true });
    }
  };

  const bind = (
    key: QueryKey,
    consumerDestroyRef: DestroyRef,
    request: HttpRequest<QueryArgs>,
    isSecure: boolean,
    allowReuse: boolean,
    keepUnusedFor: number,
  ) => {
    const destroyListener = consumerDestroyRef.onDestroy(() => unbind(key, consumerDestroyRef));

    const cacheEntry = cache.get(key);

    if (cacheEntry && allowReuse) {
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
          eventsSubject.next({ type: 'request-success', key, isSecure, request });
        }
      });

      cache.set(key, {
        consumers,
        request,
        isSecure,
        eventSubscription,
        keepUnusedFor,
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
    events$: eventsSubject.asObservable(),
    subtle: {
      cacheEntries,
      cacheVersion: cacheVersion.asReadonly(),
      evict,
    },
  };

  return repository;
};
