import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, ErrorHandler, Injector } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, Observable, Subject } from 'rxjs';
import { buildRoute } from '../legacy';
import { createHttpRequest, CreateHttpRequestClientOptions, HttpRequest } from './http-request';
import { QueryArgs, RequestArgs } from './query';
import { CreateQueryClientConfigOptions } from './query-client';
import { QueryMethod, RouteType } from './query-creator';
import { uncacheableRequestHasAllowCacheParam, uncacheableRequestHasCacheKeyParam } from './query-errors';
import { InternalRunQueryExecuteOptions, RunQueryExecuteOptions } from './query-execute-utils';
import { buildQueryCacheKey, shouldCacheQuery, ShouldRetryRequestFn } from './query-utils';

export type QueryRepositoryEvent =
  | {
      type: 'request-error';
      error: HttpErrorResponse;
      key: QueryKey;
      isSecure: boolean;
      request: HttpRequest<QueryArgs>;
    }
  | {
      type: 'request-success';
      key: QueryKey;
      isSecure: boolean;
      request: HttpRequest<QueryArgs>;
    };

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

  /** Custom retry function for this specific request */
  retryFn?: ShouldRetryRequestFn;

  /** If set, this request's cache key will be prefixed with this key */
  key?: string;

  /** The previous tracking key of the request */
  previousKey?: QueryKey | null;

  /** The destroy ref to bind the request to. If the destroy ref is destroyed, the request will be destroyed as well. */
  consumerDestroyRef: DestroyRef;

  /** Configuration on how to run the query */
  runQueryOptions?: RunQueryExecuteOptions;

  /** Internal options for running the query */
  internalRunQueryOptions?: InternalRunQueryExecuteOptions;
};

export type QueryRepositoryItem<TArgs extends QueryArgs> = {
  /** The key of the request (either a cache key for cacheable requests or a UUID for uncacheable requests) */
  key: QueryKey;

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
  unbind: (key: QueryKey | null, consumerDestroyRef: DestroyRef) => boolean;

  /** Removes all secure requests and their consumers */
  unbindAllSecure: () => void;

  /** Observable stream of repository events (errors, successes, etc.) */
  events$: Observable<QueryRepositoryEvent>;
};

/** The key of a query (either a cache key for cacheable requests or a UUID for uncacheable requests) */
export type QueryKey = string;

/** @deprecated Use QueryKey instead. All requests now have string keys (cache key or UUID). */
export type QueryKeyOrNone = QueryKey;

/** Runs .unbind() if the DestroyRef.onDestroy() gets called */
export type DestroyCleanupCallback = () => void;

/** Keeps track of all places where the request gets used. Will be cleaned up and removed if there are no more consumers.  */
type DestroyListenerMapItem = {
  consumers: Map<DestroyRef, DestroyCleanupCallback>;
  request: HttpRequest<QueryArgs>;
  isSecure: boolean;
  eventSubscription?: { unsubscribe: () => void };
};

export type QueryRepositoryDependencies = {
  /** The HTTP client to use for the requests */
  httpClient: HttpClient;

  /** The error handler to use for the requests */
  ngErrorHandler: ErrorHandler;

  /** The injector to use for reactive operations like signal->observable conversions */
  injector: Injector;
};

export type CreateQueryRepositoryConfig = CreateQueryClientConfigOptions & {
  /** The dependencies of the query repository */
  dependencies: QueryRepositoryDependencies;
};

const generateUuid = () => crypto.randomUUID();

export const createQueryRepository = (config: CreateQueryRepositoryConfig): QueryRepository => {
  const cache = new Map<QueryKey, DestroyListenerMapItem>();
  const eventsSubject = new Subject<QueryRepositoryEvent>();

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

    const cacheKey = shouldCache
      ? buildQueryCacheKey(`${options.key ? options.key + '_' : ''}${route}`, {
          body: args?.body,
          queryParams: args?.queryParams,
          pathParams: args?.pathParams,
          headers: args?.headers,
        })
      : false;

    const trackingKey = cacheKey || generateUuid();

    const previousKey = options.previousKey;

    if (cacheKey !== previousKey && previousKey) {
      unbind(previousKey, options.consumerDestroyRef);
    }

    if (shouldCache && cacheKey) {
      const cacheEntry = cache.get(cacheKey);

      if (cacheEntry) {
        bind(cacheKey, options.consumerDestroyRef, cacheEntry.request, options.isSecure ?? false, true);

        if (!runQueryOptions?.allowCache || cacheEntry.request.isStale()) {
          cacheEntry.request.execute({ allowCache: runQueryOptions?.allowCache });
        }

        return { key: cacheKey, request: cacheEntry.request as HttpRequest<TArgs> };
      }
    }

    const request = createHttpRequest<TArgs>({
      fullPath: route,
      args,
      method: options.method,
      dependencies: config.dependencies,
      clientOptions,
      cacheAdapter: config.cacheAdapter,
      retryFn: options.retryFn ?? config.retryFn,
    });

    request.execute();

    bind(trackingKey, options.consumerDestroyRef, request, options.isSecure ?? false, shouldCache);

    return { key: trackingKey, request };
  };

  const unbind = (key: QueryKey | null, consumerDestroyRef: DestroyRef) => {
    if (key === null) return false;

    const cacheEntry = cache.get(key);

    if (!cacheEntry) return false;

    cacheEntry.consumers.delete(consumerDestroyRef);

    if (cacheEntry.consumers.size === 0) {
      cacheEntry.request.destroy();
      cacheEntry.eventSubscription?.unsubscribe();
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

        cacheEntry.eventSubscription?.unsubscribe();
        cache.delete(key);
      }
    }
  };

  const bind = (
    key: QueryKey,
    consumerDestroyRef: DestroyRef,
    request: HttpRequest<QueryArgs>,
    isSecure: boolean,
    allowReuse: boolean,
  ) => {
    const destroyListener = consumerDestroyRef.onDestroy(() => unbind(key, consumerDestroyRef));

    const cacheEntry = cache.get(key);

    if (cacheEntry && allowReuse) {
      cacheEntry.consumers.set(consumerDestroyRef, destroyListener);
    } else {
      const consumers: Map<DestroyRef, DestroyCleanupCallback> = new Map([]);

      consumers.set(consumerDestroyRef, destroyListener);

      const eventSubscription = combineLatest([
        toObservable(request.error, { injector: config.dependencies.injector }),
        toObservable(request.response, { injector: config.dependencies.injector }),
      ]).subscribe(([errorValue, responseValue]) => {
        if (errorValue?.raw instanceof HttpErrorResponse) {
          eventsSubject.next({
            type: 'request-error',
            error: errorValue.raw,
            key,
            isSecure,
            request,
          });
        } else if (responseValue !== null && !errorValue) {
          eventsSubject.next({
            type: 'request-success',
            key,
            isSecure,
            request,
          });
        }
      });

      cache.set(key, {
        consumers,
        request,
        isSecure,
        eventSubscription,
      });
    }
  };

  const repository: QueryRepository = {
    request,
    unbind,
    unbindAllSecure,
    events$: eventsSubject.asObservable(),
  };

  return repository;
};
