import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ErrorHandler, inject, Injector, PLATFORM_ID } from '@angular/core';
import { createRootProvider, ProviderResult } from '@ethlete/core';
import { BuildQueryStringConfig } from '../legacy';
import { createQueryRepository, QueryRepository } from './query-repository';
import { ShouldRetryRequestFn } from './query-retry-utils';

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
   * export const [provideMyClient, injectMyClient] = createQueryClient({
   *   name: 'my-api',
   *   baseUrl: 'https://api.example.com',
   *   headers: () => {
   *     const token = previewToken();
   *     return token ? new HttpHeaders({ 'X-Preview-Token': token }) : new HttpHeaders();
   *   },
   * });
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
   * Only GET / HEAD / OPTIONS requests are refreshed: re-firing a mutation nobody asked for would
   * be a far worse surprise than a stale read.
   */
  refreshQueriesInUse: () => void;
};

export type QueryClientRef = ProviderResult<QueryClient>;
export type AnyCreateQueryClientResult = QueryClientRef;
export type AnyQueryClient = NonNullable<ReturnType<AnyCreateQueryClientResult[1]>>;

export const createQueryClient = (options: CreateQueryClientConfigOptions): QueryClientRef =>
  createRootProvider(
    () => {
      const httpClient = inject(HttpClient);
      const ngErrorHandler = inject(ErrorHandler);
      const injector = inject(Injector);

      const repository = createQueryRepository({
        ...options,
        // Retaining unused entries on the server would pin response bodies (and a pending timer) inside
        // a per-request injector for the whole window, so retention is browser only.
        retentionEnabled: isPlatformBrowser(inject(PLATFORM_ID)),
        dependencies: { httpClient, ngErrorHandler, injector },
      });

      const client: QueryClient = {
        repository,
        baseUrl: options.baseUrl,
        refreshQueriesInUse: () => repository.refreshInUse(),
      };

      return client;
    },
    {
      name: `QueryClient_${options.name}`,
    },
  );
