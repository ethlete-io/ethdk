/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { InjectionToken } from '@angular/core';
import { BuildQueryStringConfig } from '@ethlete/query';
import { QueryClient } from './query-client';

export type CreateQueryClientConfigOptions = {
  baseUrl: string;
  queryString?: BuildQueryStringConfig;
  name: string;
};

export type QueryClientConfig = {
  baseUrl: string;
  queryString?: BuildQueryStringConfig;
  token: InjectionToken<QueryClient>;
  name: string;
};

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
