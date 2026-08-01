import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DestroyRef, ErrorHandler, inject, Injector, PLATFORM_ID } from '@angular/core';
import { defineRootProvider, ProviderDefinition } from '@ethlete/core';
import { BuildQueryStringConfig } from './internal/request-route';
import { createQueryInvalidationFilter, QueryInvalidationOptions, resolveInvalidationUrl } from './query-invalidation';
import { createIndexedDbQueryPersistenceAdapter } from './persistence/query-persistence-indexed-db';
import { QueryPersistenceConfig } from './persistence/query-persistence-config';
import { createQueryPersistenceEngine, QueryPersistenceEngine } from './persistence/query-persistence-engine';
import { createQueryRepository, QueryRepository } from './query-repository';
import { ShouldRetryRequestFn } from './query-retry-utils';
import { createQueryKeyLockManager } from './sync/query-key-lock-manager';
import { QueryMultiTabSyncConfig } from './sync/query-sync-config';
import { createQuerySyncEngine, QuerySyncEngine } from './sync/query-sync-engine';
import { createQuerySyncTransport } from './sync/query-sync-transport';

export type CacheAdapterFn = (headers: HttpHeaders) => number | null;

export type CreateQueryClientConfigOptions = {
  /**
   * The base URL of the client
   * @example 'https://api.example.com/v1'
   */
  baseUrl: string;

  /** Configuration for building query strings */
  queryString?: BuildQueryStringConfig;

  /**
   * Headers sent with every request of this client — an API token, a tenant id, a preview
   * credential. Per-query `args.headers` are merged on top and win per header name.
   *
   * Pass a function to make them dynamic: it is called on every execution, so reading a signal
   * inside means later requests pick the new value up on their own.
   *
   * Client headers are deliberately **not** part of the cache key: they are the same for every
   * query of the client, so including them would only ever churn the whole cache at once. That
   * means already-resolved queries keep their response when the headers change — call
   * {@link QueryClient.refreshQueriesInUse} to re-run them (the v3 equivalent of v2's
   * `setDefaultHeaders({ refreshQueriesInUse: true })`).
   *
   * @example
   * const previewToken = signal<string | null>(null);
   *
   * const MY_CLIENT = createQueryClient({
   *   name: 'my-api',
   *   baseUrl: 'https://api.example.com',
   *   headers: () => {
   *     const token = previewToken();
   *     return token ? new HttpHeaders({ 'X-Preview-Token': token }) : new HttpHeaders();
   *   },
   * });
   *
   * export const provideMyClient = toProvideFn(MY_CLIENT);
   * export const injectMyClient = toInjectFn(MY_CLIENT);
   */
  headers?: HttpHeaders | (() => HttpHeaders);

  /** The name of the client */
  name: string;

  /**
   * The cache adapter function to use for the client.
   * It determines how long the response of a request can be cached.
   *
   * @default extractExpiresInSeconds()
   */
  cacheAdapter?: CacheAdapterFn;

  /**
   * The retry function to use for the client.
   * It determines if a request should be retried after it failed.
   *
   * @default shouldRetryRequest()
   */
  retryFn?: ShouldRetryRequestFn;

  /**
   * How long (in ms) a cache entry is kept after its last consumer was destroyed.
   *
   * Within that window a query that mounts again — a list page reached via browser back navigation,
   * for instance — binds to the existing entry and renders its previous response immediately while it
   * revalidates in the background, instead of starting from a loading state. Unlike the header derived
   * freshness TTL (`cacheAdapter`) this is independent of `cache-control`, so it also applies to
   * private/authenticated responses.
   *
   * Set to `0` to destroy entries as soon as their last consumer goes away. Only entries that
   * actually hold a response are retained, and at most 50 unused entries are kept per client
   * (least recently orphaned dropped first). Always `0` on the server.
   *
   * Can be overridden per query creator.
   *
   * @default 300000 (5 minutes)
   */
  keepUnusedFor?: number;

  /**
   * Coordinates this client with its own instances in the user's **other tabs**, over a
   * `BroadcastChannel` and the Web Locks API. Three things happen once it is on:
   *
   * 1. a successful read is shared, so the same query shows the same data in every tab without a
   *    second request,
   * 2. the same cache key polled in several tabs is polled by one of them, the others being fed the
   *    result,
   * 3. a successful mutation in one tab refreshes what the other tabs currently have on screen.
   *
   * On by default: a user with several tabs open is the normal case, and all three behaviors are what
   * they would expect to happen. Pass an object to configure the parts individually, or `false` to
   * keep every tab entirely on its own. Always inert on the server, and a no-op in a browser without
   * `BroadcastChannel`.
   *
   * The one thing it requires is that response bodies survive a structured clone, which JSON always
   * does; a body that cannot be cloned is warned about in dev mode and simply not shared. Individual
   * queries can stay tab-local via {@link BaseQueryCreatorOptions.multiTabSync} — worth doing for very
   * large payloads on a short polling interval.
   *
   * @default true
   */
  multiTabSync?: boolean | QueryMultiTabSyncConfig;

  /**
   * Keeps this client's successful reads on disk (IndexedDB), so a reload renders the last known data
   * right away instead of a loading state — and so does a cold start with no network at all.
   *
   * A hydrated response is **always** revalidated: persisted data fills a cache entry while its request
   * is already on its way, and never replaces something newer. What the user sees is last week's list
   * immediately, then this week's a moment later; offline, they see last week's list plus the error.
   *
   * On by default, and bounded by design: only successful reads are stored, **secure responses need an
   * explicit {@link BaseQueryCreatorOptions.persistence} on the query** (and are removed again on
   * logout), nothing older than `maxAge` is ever shown, and at most `maxEntries` responses are kept.
   * Pass an object to tune those, or `false` to keep everything in memory as before. Always inert on the
   * server and in a browser without IndexedDB.
   *
   * Bump {@link QueryPersistenceConfig.version} in the commit that changes what a response looks like —
   * that is what stops a returning user's disk copy from reaching code that can no longer read it.
   *
   * @default true
   */
  persistence?: boolean | QueryPersistenceConfig;
};

/**
 * Advanced client internals. **Not part of the general public contract** — do not build application
 * logic on top of these.
 */
export type QueryClientSubtle = {
  /**
   * The multi-tab sync engine, or `null` when this client has no
   * {@link CreateQueryClientConfigOptions.multiTabSync} (or runs on the server). Query features reach
   * it through `deps.client`.
   */
  sync: QuerySyncEngine | null;

  /**
   * The persisted response store, or `null` when this client has no
   * {@link CreateQueryClientConfigOptions.persistence} (or runs on the server).
   */
  persistence: QueryPersistenceEngine | null;
};

export type QueryClient = {
  repository: QueryRepository;

  /** The base URL the client was configured with. */
  baseUrl: string;

  /**
   * Re-executes every cacheable request this client currently has consumers for, bypassing the
   * cache and restarting the ones still in flight.
   *
   * The case this exists for is a change to something every request carries but nothing tracks —
   * typically a client-level header (see {@link CreateQueryClientConfigOptions.headers}). Setting
   * the new value only affects *subsequent* requests, so anything already resolved keeps data
   * fetched under the old one until this is called.
   *
   * Only cacheable requests are refreshed: re-firing a mutation nobody asked for would be a far worse
   * surprise than a stale read.
   *
   * @see QueryClient.invalidateQueries for the case where the *data* went stale rather than the
   * request, which is the one that also concerns the user's other tabs.
   */
  refreshQueriesInUse: () => void;

  /**
   * Re-executes the queries this client has consumers for whose data the caller knows to be out of
   * date — after a mutation, or a push message saying something changed server-side — and tells the
   * user's other tabs to do the same.
   *
   * Narrow it by `url`, by `filter`, or leave it open to invalidate everything in use:
   *
   * @example
   * await createPlayer.execute({ body });
   *
   * client.invalidateQueries({ url: '/players' }); // /players, /players/1, /players?page=2
   * client.invalidateQueries(); // everything on screen, here and in the other tabs
   *
   * Same set as {@link QueryClient.refreshQueriesInUse}: cacheable entries with at least one
   * consumer, cache bypassed, in-flight requests restarted. Entries sitting out their `keepUnusedFor`
   * window are deliberately left alone — they revalidate on their own when a consumer binds again,
   * and refreshing what nobody is looking at is how an invalidation turns into a request storm.
   *
   * Reaching the other tabs needs {@link CreateQueryClientConfigOptions.multiTabSync} (on by default);
   * without it this is a local call, and `otherTabs: false` makes it one deliberately.
   */
  invalidateQueries: (options?: QueryInvalidationOptions) => void;

  /**
   * Removes every response this client persisted (see
   * {@link CreateQueryClientConfigOptions.persistence}). Resolves once the store is empty; a no-op when
   * persistence is off.
   *
   * What it is for is a switch of *who* is using the app — a different user logging in on a shared
   * device — where the previous session's public data should not be waiting for them. A logout already
   * removes persisted **secure** responses on its own.
   */
  clearPersistedQueries: () => Promise<void>;

  /**
   * Resolves once persisted responses are available to hydrate cache entries with, or right away when
   * persistence is off or the code runs on the server.
   *
   * Nothing needs to await this — a query created before it resolves is hydrated as soon as it does.
   * It exists for the app that would rather delay its first paint than show a loading state it knows it
   * has data for.
   *
   * @example
   * provideAppInitializer(() => injectMyClient().whenPersistenceReady)
   */
  whenPersistenceReady: Promise<void>;

  /** Advanced client internals. */
  subtle: QueryClientSubtle;
};

export type QueryClientRef = ProviderDefinition<QueryClient>;
export type AnyCreateQueryClientResult = QueryClientRef;
export type AnyQueryClient = NonNullable<ReturnType<AnyCreateQueryClientResult['inject']>>;

export const createQueryClient = (options: CreateQueryClientConfigOptions): QueryClientRef =>
  defineRootProvider(
    () => {
      const httpClient = inject(HttpClient);
      const ngErrorHandler = inject(ErrorHandler);
      const injector = inject(Injector);
      const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

      const repository = createQueryRepository({
        ...options,
        // Retaining unused entries on the server would pin response bodies (and a pending timer) inside
        // a per-request injector for the whole window, so retention is browser only.
        retentionEnabled: isBrowser,
        dependencies: { httpClient, ngErrorHandler, injector },
      });

      const { multiTabSync = true } = options;
      const syncConfig = multiTabSync === false ? null : multiTabSync === true ? {} : multiTabSync;
      const channelName = syncConfig?.channelName ?? `et-query-sync-${options.name}`;

      // Same server guard as retention above: there are no other tabs to talk to, and a per-request
      // injector must not open a channel it would then have to remember to close.
      const sync =
        isBrowser && syncConfig
          ? createQuerySyncEngine({
              config: syncConfig,
              repository,
              transport: createQuerySyncTransport(channelName),
              // Keyed off the channel, not the client name: the channel is what says "these clients
              // are the same client, in different tabs", so the locks have to agree with it.
              lockManager: createQueryKeyLockManager(`et-query-poll:${channelName}`),
            })
          : null;

      const destroyRef = inject(DestroyRef);

      if (sync) destroyRef.onDestroy(sync.destroy);

      const { persistence = true } = options;
      const persistenceConfig = persistence === false ? null : persistence === true ? {} : persistence;

      // Same server guard once more: a per-request injector has no disk to read and no session to
      // remember, and `transferCache` already covers the SSR hand-off to the browser.
      const persistenceEngine =
        isBrowser && persistenceConfig
          ? createQueryPersistenceEngine({
              config: persistenceConfig,
              repository,
              adapter:
                (typeof persistenceConfig.adapter === 'function'
                  ? persistenceConfig.adapter()
                  : persistenceConfig.adapter) ??
                createIndexedDbQueryPersistenceAdapter({
                  storageName: persistenceConfig.storageName ?? `et-query-persistence-${options.name}`,
                }),
            })
          : null;

      if (persistenceEngine) {
        // Writes are coalesced, so the tab going away is the one moment they cannot wait: a reload right
        // after a fetch is exactly the case persistence exists for. `visibilitychange` is what fires
        // reliably on mobile, where `pagehide` sometimes does not.
        const flush = () => void persistenceEngine.flush();
        const flushWhenHidden = () => {
          if (document.visibilityState === 'hidden') flush();
        };

        document.addEventListener('visibilitychange', flushWhenHidden);
        window.addEventListener('pagehide', flush);

        destroyRef.onDestroy(() => {
          document.removeEventListener('visibilitychange', flushWhenHidden);
          window.removeEventListener('pagehide', flush);
          persistenceEngine.destroy();
        });
      }

      const client: QueryClient = {
        repository,
        baseUrl: options.baseUrl,
        refreshQueriesInUse: () => repository.refreshInUse(),
        invalidateQueries: (invalidation) => {
          const url = invalidation?.url ? resolveInvalidationUrl(options.baseUrl, invalidation.url) : null;

          repository.refreshInUse(createQueryInvalidationFilter({ url, filter: invalidation?.filter }));

          // The resolved URL is what travels: the other tabs are the same client, so they would
          // resolve it identically, and a message that needs no interpretation cannot drift.
          if (invalidation?.otherTabs ?? true) sync?.postInvalidation(url);
        },
        clearPersistedQueries: () => persistenceEngine?.clear() ?? Promise.resolve(),
        whenPersistenceReady: persistenceEngine?.whenReady ?? Promise.resolve(),
        subtle: { sync, persistence: persistenceEngine },
      };

      return client;
    },
    {
      name: `QueryClient_${options.name}`,
    },
  );
