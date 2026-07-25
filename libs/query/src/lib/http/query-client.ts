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
      };

      return client;
    },
    {
      name: `QueryClient_${options.name}`,
    },
  );
