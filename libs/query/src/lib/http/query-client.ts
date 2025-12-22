import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ErrorHandler, inject } from '@angular/core';
import { createRootProvider, ProviderResult } from '@ethlete/core';
import { BuildQueryStringConfig } from '../legacy';
import { createQueryRepository, QueryRepository } from './query-repository';
import { ShouldRetryRequestFn } from './query-utils';

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
};

export type QueryClient = {
  repository: QueryRepository;
};

export type CreateQueryClientResult = ProviderResult<QueryClient>;
export type AnyCreateQueryClientResult = CreateQueryClientResult;
export type AnyQueryClient = NonNullable<ReturnType<AnyCreateQueryClientResult[1]>>;

export const createQueryClient = (options: CreateQueryClientConfigOptions): CreateQueryClientResult =>
  createRootProvider(
    () => {
      const httpClient = inject(HttpClient);
      const ngErrorHandler = inject(ErrorHandler);

      const repository = createQueryRepository({ ...options, dependencies: { httpClient, ngErrorHandler } });

      const client: QueryClient = {
        repository,
      };

      return client;
    },
    {
      name: `QueryClient_${options.name}`,
    },
  );
