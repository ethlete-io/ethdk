import { HttpHeaders } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { BuildQueryStringConfig } from '../../request';
import { QueryClient } from './query-client';
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

export type QueryClientConfig = CreateQueryClientConfigOptions & {
  /** A generated token for dependency injection */
  token: QueryClientRef;
};

/**
 * A token for a query client.
 * This token can be used to inject a query client into a service.
 */
export type QueryClientRef = InjectionToken<QueryClient>;

/**
 * This function creates a query client config.
 * The config is used to create a query client using the `provideQueryClient(myConfig)` function.
 */
export const createQueryClientConfig = (options: CreateQueryClientConfigOptions) => {
  const token = new InjectionToken<QueryClientConfig>(`QueryClient_${options.name}`);

  const clientConfig: QueryClientConfig = {
    baseUrl: options.baseUrl,
    token,
    name: options.name,
    queryString: options.queryString,

    // createHttpRequest will use fallbacks if these are not provided
    cacheAdapter: options.cacheAdapter,
    retryFn: options.retryFn,
  };

  return clientConfig;
};
