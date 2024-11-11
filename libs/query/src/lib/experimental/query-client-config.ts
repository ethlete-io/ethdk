import { HttpHeaders } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { BuildQueryStringConfig } from '../request';
import { QueryClient } from './query-client';
import { ShouldRetryRequestFn } from './query-utils';

export type CacheAdapterFn = (headers: HttpHeaders) => number | null;

export type CreateQueryClientConfigOptions = {
  baseUrl: string;
  queryString?: BuildQueryStringConfig;
  name: string;
  cacheAdapter?: CacheAdapterFn;
  retryFn?: ShouldRetryRequestFn;
};

export type QueryClientConfig = CreateQueryClientConfigOptions & {
  token: QueryClientRef;
};

export type QueryClientRef = InjectionToken<QueryClient>;

export const createQueryClientConfig = (options: CreateQueryClientConfigOptions) => {
  const token = new InjectionToken<QueryClientConfig>(`QueryClient_${options.name}`);

  const clientConfig: QueryClientConfig = {
    baseUrl: options.baseUrl,
    token,
    name: options.name,
    queryString: options.queryString,
  };

  return clientConfig;
};
