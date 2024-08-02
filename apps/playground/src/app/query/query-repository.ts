/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-function */

import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject } from '@angular/core';
import { buildQueryCacheKey, buildRoute, shouldCacheQuery } from '@ethlete/query';
import { HttpRequest, createHttpRequest } from './http-request';
import { QueryArgs } from './query';
import { QueryClientConfig } from './query-client-config';
import { QueryMethod, RouteType } from './query-creator';

export type QueryRepositoryRequestOptions<TArgs extends QueryArgs> = {
  method: QueryMethod;
  route: RouteType<TArgs>;
  pathParams?: Record<string, string | number>;
  queryParams?: any;
  body?: any;
  reportProgress?: boolean;
  withCredentials?: boolean;
  transferCache?: boolean | { includeHeaders?: string[] };
  responseType?: 'json';
  key?: string;

  skipExecution?: boolean;

  destroyRef: DestroyRef;
};

export type QueryRepository = {
  request: <TArgs extends QueryArgs>(
    options: QueryRepositoryRequestOptions<TArgs>,
  ) => { key: string | false; request: HttpRequest<TArgs> };
  unbind: (key: string | false, destroyRef: DestroyRef) => void;
};

export const createQueryRepository = (config: QueryClientConfig): QueryRepository => {
  const httpClient = inject(HttpClient);

  const cache = new Map<
    string,
    {
      consumers: Map<DestroyRef, () => void>;
      request: HttpRequest<QueryArgs>;
    }
  >();

  const request = <TArgs extends QueryArgs>(options: QueryRepositoryRequestOptions<TArgs>) => {
    const shouldCache = shouldCacheQuery(options.method);

    const route = buildRoute({
      base: config.baseUrl,
      route: options.route,
      pathParams: options.pathParams,
      queryParams: options.queryParams,
      queryParamConfig: config.queryString,
    });

    const key =
      shouldCache &&
      buildQueryCacheKey(`${options.key ? options.key + '_' : ''}${route}`, {
        body: options.body,
        queryParams: options.queryParams,
        pathParams: options.pathParams,
        // TODO: remaining props
      });

    if (shouldCache && key) {
      const cacheEntry = cache.get(key);

      if (cacheEntry) {
        bind(key, options.destroyRef, cacheEntry.request);

        if (!options.skipExecution) cacheEntry.request.execute();

        return { key, request: cacheEntry.request as HttpRequest<TArgs> };
      }
    }

    const request = createHttpRequest<TArgs>({
      fullPath: route,
      body: options.body,
      reportProgress: options.reportProgress,
      withCredentials: options.withCredentials,
      transferCache: options.transferCache,
      responseType: options.responseType || 'json',
      method: options.method,
      httpClient,
      cacheAdapter: config.cacheAdapter,
      retryFn: config.retryFn,
    });

    if (!options.skipExecution) request.execute();

    if (shouldCache && key) {
      bind(key, options.destroyRef, request);
    }

    return { key, request };
  };

  const unbind = (key: string | false, destroyRef: DestroyRef) => {
    if (!key) return;

    const cacheEntry = cache.get(key);

    if (!cacheEntry) return;

    cacheEntry.consumers.delete(destroyRef);

    if (cacheEntry.consumers.size === 0) {
      cacheEntry.request.destroy();
      cache.delete(key);
    }
  };

  const bind = (key: string | false, destroyRef: DestroyRef, request: HttpRequest<QueryArgs>) => {
    if (!key) return;

    const destroyListener = destroyRef.onDestroy(() => unbind(key, destroyRef));

    const cacheEntry = cache.get(key);

    if (cacheEntry) {
      cacheEntry.consumers.set(destroyRef, destroyListener);
    } else {
      const consumers: Map<DestroyRef, () => void> = new Map([]);

      consumers.set(destroyRef, destroyListener);

      cache.set(key, {
        consumers,
        request,
      });
    }
  };

  const repository: QueryRepository = {
    request,
    unbind,
  };

  return repository;
};
