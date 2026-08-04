import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DestroyRef, ErrorHandler, inject, Injector, PLATFORM_ID } from '@angular/core';
import { defineRootProvider, ProviderDefinition } from '@ethlete/core';
import { describeQueryDevtoolsFeatures, QueryDevtoolsFeature } from '../devtools/query-devtools-features';
import { isQueryDevtoolsEnabled } from '../devtools/query-devtools-hook';
import { BuildQueryStringConfig } from './internal/request-route';
import { createQueryInvalidationFilter, QueryInvalidationOptions, resolveInvalidationUrl } from './query-invalidation';
import { QueryPersistenceEngine } from './persistence/query-persistence-engine';
import {
  QueryClientFeature,
  QueryClientFeatureFn,
  QueryClientFeatureType,
  QueryClientPersistenceFeature,
  QueryClientMultiTabSyncFeature,
} from './query-client-features';
import { queryClientFeatureUsedMultipleTimes } from './query-errors';
import { createQueryRepository, QueryRepository } from './query-repository';
import { ShouldRetryRequestFn } from './query-retry-utils';
import { QuerySyncEngine } from './sync/query-sync-engine';

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
   * Headers sent with every request of this client - an API token, a tenant id, a preview
   * credential. Per-query `args.headers` are merged on top and win per header name.
   *
   * Pass a function to make them dynamic: it is called on every execution, so reading a signal
   * inside means later requests pick the new value up on their own.
   *
   * Client headers are deliberately **not** part of the cache key: they are the same for every
   * query of the client, so including them would only ever churn the whole cache at once. That
   * means already-resolved queries keep their response when the headers change - call
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
   * @default the `withDefaultRetry()` policy, or no retry at all without that client feature
   */
  retryFn?: ShouldRetryRequestFn;

  /**
   * How long (in ms) a cache entry is kept after its last consumer was destroyed.
   *
   * Within that window a query that mounts again - a list page reached via browser back navigation,
   * for instance - binds to the existing entry and renders its previous response immediately while it
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
   * Opt-in subsystems of this client. Nothing is on by default - a client without features ships
   * neither the multi-tab sync engine nor the persistence engine at all.
   *
   * - {@link withMultiTabSync} coordinates the client with its own instances in the user's other tabs,
   * - {@link withQueryPersistence} keeps successful reads on disk so a reload renders them right away,
   * - {@link withHtmlErrorParsing} reads the sentence out of an HTML error page,
   * - {@link withSymfonyErrors} reads Symfony / class-validator violation lists,
   * - {@link withDefaultRetry} retries connection failures, 5xx, 408/425 and 429,
   * - {@link withEthleteApiErrors} is the three error features above in one.
   *
   * Each feature may be used at most once. The error-pipeline features are installed process-wide
   * rather than per client - which body shapes an app understands is a property of the app.
   *
   * @example
   * const MY_CLIENT = createQueryClient({
   *   name: 'my-api',
   *   baseUrl: 'https://api.example.com',
   *   features: [withMultiTabSync(), withQueryPersistence(), withEthleteApiErrors()],
   * });
   */
  features?: readonly QueryClientFeatureFn[];
};

/**
 * Advanced client internals. **Not part of the general public contract** - do not build application
 * logic on top of these.
 */
export type QueryClientSubtle = {
  /**
   * The multi-tab sync engine, or `null` when this client has no {@link withMultiTabSync} feature (or
   * runs on the server). Query features reach it through `deps.client`.
   */
  sync: QuerySyncEngine | null;

  /**
   * The persisted response store, or `null` when this client has no {@link withQueryPersistence}
   * feature (or runs on the server).
   */
  persistence: QueryPersistenceEngine | null;

  /**
   * The client's features and the options each was configured with, for the devtools panel. Empty
   * unless `provideQueryDevtools()` is used.
   */
  devtoolsFeatures: QueryDevtoolsFeature[];
};

export type QueryClient = {
  repository: QueryRepository;

  /** The base URL the client was configured with. */
  baseUrl: string;

  /**
   * Re-executes every cacheable request this client currently has consumers for, bypassing the
   * cache and restarting the ones still in flight.
   *
   * The case this exists for is a change to something every request carries but nothing tracks -
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
   * date - after a mutation, or a push message saying something changed server-side - and tells the
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
   * window are deliberately left alone - they revalidate on their own when a consumer binds again,
   * and refreshing what nobody is looking at is how an invalidation turns into a request storm.
   *
   * Reaching the other tabs needs the {@link withMultiTabSync} client feature; without it this is a
   * local call, and `otherTabs: false` makes it one deliberately.
   */
  invalidateQueries: (options?: QueryInvalidationOptions) => void;

  /**
   * Removes every response this client persisted (see {@link withQueryPersistence}). Resolves once
   * the store is empty; a no-op when the client has no persistence feature.
   *
   * What it is for is a switch of *who* is using the app - a different user logging in on a shared
   * device - where the previous session's public data should not be waiting for them. A logout already
   * removes persisted **secure** responses on its own.
   */
  clearPersistedQueries: () => Promise<void>;

  /**
   * Resolves once persisted responses are available to hydrate cache entries with, or right away when
   * persistence is off or the code runs on the server.
   *
   * Nothing needs to await this - a query created before it resolves is hydrated as soon as it does.
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

      const destroyRef = inject(DestroyRef);

      let sync: QuerySyncEngine | null = null;
      let persistenceEngine: QueryPersistenceEngine | null = null;
      const appliedFeatures: QueryClientFeature[] = [];

      if (options.features?.length) {
        const seen = new Set<QueryClientFeatureType>();

        for (const featureFn of options.features) {
          const feature = featureFn({ clientName: options.name, repository, destroyRef, isBrowser });

          if (seen.has(feature.type)) throw queryClientFeatureUsedMultipleTimes(feature.type);
          seen.add(feature.type);
          appliedFeatures.push(feature);

          if (feature.type === QueryClientFeatureType.MULTI_TAB_SYNC) {
            sync = (feature as QueryClientMultiTabSyncFeature).instance;
          } else if (feature.type === QueryClientFeatureType.PERSISTENCE) {
            persistenceEngine = (feature as QueryClientPersistenceFeature).instance;
          }
        }
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
        subtle: {
          sync,
          persistence: persistenceEngine,
          devtoolsFeatures: isQueryDevtoolsEnabled() ? describeQueryDevtoolsFeatures(appliedFeatures) : [],
        },
      };

      return client;
    },
    {
      name: `QueryClient_${options.name}`,
    },
  );
