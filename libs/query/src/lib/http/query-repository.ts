import { HttpClient } from '@angular/common/http';
import { DestroyRef, ErrorHandler } from '@angular/core';
import { buildRoute } from '../legacy';
import { CreateHttpRequestClientOptions, HttpRequest, createHttpRequest } from './http-request';
import { QueryArgs, RequestArgs } from './query';
import { QueryClientConfig } from './query-client-config';
import { QueryMethod, RouteType } from './query-creator';
import { uncacheableRequestHasAllowCacheParam, uncacheableRequestHasCacheKeyParam } from './query-errors';
import { InternalRunQueryExecuteOptions, RunQueryExecuteOptions } from './query-execute-utils';
import { buildQueryCacheKey, shouldCacheQuery } from './query-utils';

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

  /** The client options of the request */
  clientOptions?: CreateHttpRequestClientOptions;

  /** If set, this request's cache key will be prefixed with this key */
  key?: string;

  /** The previous cache key of the request */
  previousKey?: string | false;

  /** The destroy ref to bind the request to. If the destroy ref is destroyed, the request will be destroyed as well. */
  consumerDestroyRef: DestroyRef;

  /** Configuration on how to run the query */
  runQueryOptions?: RunQueryExecuteOptions;

  /** Internal options for running the query */
  internalRunQueryOptions?: InternalRunQueryExecuteOptions;
};

export type QueryRepositoryItem<TArgs extends QueryArgs> = {
  /** The key of the request. If the key is `false`, the request is not cached, otherwise it is. */
  key: QueryKeyOrNone;

  /** The request object */
  request: HttpRequest<TArgs>;
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
  unbind: (key: QueryKeyOrNone, consumerDestroyRef: DestroyRef) => boolean;

  /** Removes all secure requests and their consumers */
  unbindAllSecure: () => void;
};

/** The key of a query */
export type QueryKey = string;

/** A key that will not be cached */
export type QueryKeyNoCache = false;

/** A key that may or may not be cached */
export type QueryKeyOrNone = QueryKey | QueryKeyNoCache;

/** Runs .unbind() if the DestroyRef.onDestroy() gets called */
export type DestroyCleanupCallback = () => void;

/** Keeps track of all places where the request gets used. Will be cleaned up and removed if there are no more consumers.  */
type DestroyListenerMapItem = {
  consumers: Map<DestroyRef, DestroyCleanupCallback>;
  request: HttpRequest<QueryArgs>;
  isSecure: boolean;
};

export type QueryRepositoryDependencies = {
  /** The HTTP client to use for the requests */
  httpClient: HttpClient;

  /** The error handler to use for the requests */
  ngErrorHandler: ErrorHandler;
};

export type CreateQueryRepositoryConfig = QueryClientConfig & {
  /** The dependencies of the query repository */
  dependencies: QueryRepositoryDependencies;
};

export const createQueryRepository = (config: CreateQueryRepositoryConfig): QueryRepository => {
  const cache = new Map<QueryKey, DestroyListenerMapItem>();

  const request = <TArgs extends QueryArgs>(options: QueryRepositoryRequestOptions<TArgs>) => {
    const { args, clientOptions, runQueryOptions } = options;
    const shouldCache =
      options.internalRunQueryOptions?.useQueryRepositoryCache === false
        ? false
        : shouldCacheQuery(options.method) || options.internalRunQueryOptions?.useQueryRepositoryCache === true;

    if (!shouldCache && options.key) throw uncacheableRequestHasCacheKeyParam(options.key);
    if (!shouldCache && runQueryOptions?.allowCache) throw uncacheableRequestHasAllowCacheParam();

    const route = buildRoute({
      base: config.baseUrl,
      route: options.route,
      pathParams: args?.pathParams,
      queryParams: args?.queryParams,
      queryParamConfig: config.queryString,
    });

    const key =
      shouldCache &&
      buildQueryCacheKey(`${options.key ? options.key + '_' : ''}${route}`, {
        body: args?.body,
        queryParams: args?.queryParams,
        pathParams: args?.pathParams,
        headers: args?.headers,
      });

    const previousKey = options.previousKey;

    if (key !== previousKey && previousKey) {
      unbind(previousKey, options.consumerDestroyRef);
    }

    if (shouldCache && key) {
      const cacheEntry = cache.get(key);

      if (cacheEntry) {
        bind(key, options.consumerDestroyRef, cacheEntry.request, options.isSecure ?? false);

        if (!runQueryOptions?.allowCache || cacheEntry.request.isStale()) {
          cacheEntry.request.execute({ allowCache: runQueryOptions?.allowCache });
        }

        return { key, request: cacheEntry.request as HttpRequest<TArgs> };
      }
    }

    const request = createHttpRequest<TArgs>({
      fullPath: route,
      args,
      method: options.method,
      dependencies: config.dependencies,
      clientOptions,
      cacheAdapter: config.cacheAdapter,
      retryFn: config.retryFn,
    });

    request.execute();

    if (shouldCache && key) {
      bind(key, options.consumerDestroyRef, request, options.isSecure ?? false);
    }

    return { key, request };
  };

  const unbind = (key: QueryKeyOrNone, consumerDestroyRef: DestroyRef) => {
    if (!key) return false;

    const cacheEntry = cache.get(key);

    if (!cacheEntry) return false;

    cacheEntry.consumers.delete(consumerDestroyRef);

    if (cacheEntry.consumers.size === 0) {
      cacheEntry.request.destroy();
      cache.delete(key);
    }

    return true;
  };

  const unbindAllSecure = () => {
    for (const [key, cacheEntry] of cache.entries()) {
      if (cacheEntry.isSecure) {
        for (const consumerDestroyRef of cacheEntry.consumers.keys()) {
          unbind(key, consumerDestroyRef);
        }

        cache.delete(key);
      }
    }
  };

  const bind = (key: QueryKey, consumerDestroyRef: DestroyRef, request: HttpRequest<QueryArgs>, isSecure: boolean) => {
    const destroyListener = consumerDestroyRef.onDestroy(() => unbind(key, consumerDestroyRef));

    const cacheEntry = cache.get(key);

    if (cacheEntry) {
      cacheEntry.consumers.set(consumerDestroyRef, destroyListener);
    } else {
      const consumers: Map<DestroyRef, DestroyCleanupCallback> = new Map([]);

      consumers.set(consumerDestroyRef, destroyListener);

      cache.set(key, {
        consumers,
        request,
        isSecure,
      });
    }
  };

  const repository: QueryRepository = {
    request,
    unbind,
    unbindAllSecure,
  };

  return repository;
};
