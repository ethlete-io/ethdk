import { Injector } from '@angular/core';
import { createBaseQueryCreator } from './base-query-creator-factory';
import { HttpRequestResponseType, HttpRequestTransferCacheConfig } from './http-request';
import { AnyNewQuery, PathParamsType, Query, QueryArgs, RawResponseType, ResponseType, createQuery } from './query';
import { AnyCreateQueryClientResult } from './query-client';
import { QueryFeature } from './query-features';
import { ShouldRetryRequestFn } from './query-retry-utils';

export type RouteType<TArgs extends QueryArgs> =
  PathParamsType<TArgs> extends { [key: string]: unknown } ? (args: TArgs['pathParams']) => RouteString : RouteString;

export type RouteString = `/${string}`;

export type BaseQueryCreatorOptionsSubtle = {
  /**
   * If true, the request will be forced to be cached (saved inside the query repository).
   * Can be used to e.g. cache GQL queries transported via POST
   *
   * - `true` means the request will always be cached
   * - `false` means the request will never be cached
   * - `undefined` means the request will be cached if the method is GET, OPTIONS or HEAD
   */
  useQueryRepositoryCache?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type BaseQueryCreatorOptions<TArgs extends QueryArgs = QueryArgs> = {
  /**
   * If true, the query loading state will include progress information.
   * This is useful for file uploads and downloads.
   *
   * **Warning**: Upload progress events are not supported by browsers when using the fetch API, such as with `provideHttpClient(withFetch())`.
   * In this case, you should use the older XHR implementation by omitting `withFetch()`. But take into account that XHR is not supported in server-side rendering environments.
   *
   * @see https://angular.dev/guide/http/making-requests#receiving-raw-progress-events
   *
   * @default false
   */
  reportProgress?: boolean;

  /**
   * The response type of the query.
   * @default 'json'
   */
  responseType?: HttpRequestResponseType;

  /**
   * Whether to include credentials (cookies) in the request or not.
   * @default false
   */
  withCredentials?: boolean;

  /**
   * This property accepts either a boolean to enable/disable transferring cache for eligible
   * requests performed using `HttpClient`, or an object, which allows to configure cache
   * parameters, such as which headers should be included (no headers are included by default).
   *
   * Setting this property will override the options passed to `provideClientHydration()` for this
   * particular request
   */
  transferCache?: HttpRequestTransferCacheConfig;

  /**
   * Custom retry function for this specific query creator.
   * If provided, overrides the retry function configured at the client level.
   *
   * @default Client's retryFn or shouldRetryRequest()
   */
  retryFn?: ShouldRetryRequestFn;

  /** Advanced query creator features. **WARNING!** Incorrectly using these features will likely **BREAK** your application. You have been warned! */
  subtle?: BaseQueryCreatorOptionsSubtle;
};

type HasKey<T, K extends PropertyKey> = K extends keyof T
  ? undefined extends T[K]
    ? K extends keyof Required<T>
      ? true
      : false
    : true
  : false;

/**
 * Determines if rawResponse type differs from response type.
 * Returns true if rawResponse is explicitly defined and differs from response.
 */
export type RequiresTransform<TArgs extends QueryArgs> =
  HasKey<TArgs, 'rawResponse'> extends false
    ? false
    : RawResponseType<TArgs> extends ResponseType<TArgs>
      ? ResponseType<TArgs> extends RawResponseType<TArgs>
        ? false
        : true
      : true;

export type CreateQueryCreatorOptions<TArgs extends QueryArgs = QueryArgs> = BaseQueryCreatorOptions<TArgs> &
  (RequiresTransform<TArgs> extends true
    ? {
        /**
         * Transforms the raw HTTP response to the final response type.
         * **Required** because rawResponse type differs from response type.
         *
         * @example
         * ```ts
         * transformResponse: (raw) => raw.data
         * ```
         */
        transformResponse: (rawResponse: RawResponseType<TArgs>) => ResponseType<TArgs>;
      }
    : {
        /**
         * Transforms the raw HTTP response to the final response type.
         * Useful for unwrapping response wrappers (e.g., GraphQL's `{ data: ... }` format).
         *
         * @example
         * ```ts
         * transformResponse: (raw) => raw.data
         * ```
         */
        transformResponse?: (rawResponse: RawResponseType<TArgs>) => ResponseType<TArgs>;
      });

export type QueryCreator<TArgs extends QueryArgs> = {
  (...features: QueryFeature<TArgs>[]): Query<TArgs>;
  (queryConfig: QueryConfig, ...features: QueryFeature<TArgs>[]): Query<TArgs>;

  /**
   * Creates a new query creator with merged options.
   * The new creator inherits all options from the original and overrides them with the provided options.
   *
   * @example
   * ```ts
   * const originalCreator = myApiPost('/api/data');
   * const creatorWithRetry = originalCreator.clone({ retryFn: customRetryFn });
   * ```
   */
  clone: (additionalOptions: Partial<BaseQueryCreatorOptions<TArgs>>) => QueryCreator<TArgs>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyQueryCreator = QueryCreator<any>;

export type QueryArgsOf<T extends AnyQueryCreator | AnyNewQuery> =
  T extends QueryCreator<infer TArgs> ? TArgs : T extends Query<infer TArgs> ? TArgs : never;

export type RunQueryCreator<TCreator extends AnyQueryCreator> = ReturnType<TCreator>;

export type QueryMethod = 'GET' | 'OPTIONS' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'TRACE' | 'CONNECT';

export type InternalCreateQueryCreatorOptions<TArgs extends QueryArgs> = {
  /**
   * The route of the query.
   * If the query has path params, the route should be a function that takes the path params as an argument.
   * Otherwise, it should be a string.
   */
  route: RouteType<TArgs>;

  method: QueryMethod;
  client: AnyCreateQueryClientResult;
};

export type QueryConfig = {
  /** A custom id to use for this query. Only affects queries that can be cached. */
  key?: string;

  /**
   * If true, the query will not be executed automatically.
   * Does not affect mutations such as POST, PUT etc. since those are never executed automatically.
   */
  onlyManualExecution?: boolean;

  /**
   * If true, the query will not throw an error because a "withArgs()" feature is missing.
   */
  silenceMissingWithArgsFeatureError?: boolean;

  /**
   * A custom injector to use for this query.
   */
  injector?: Injector;
};

export const splitQueryConfig = <TArgs extends QueryArgs>(args: (QueryFeature<TArgs> | QueryConfig)[]) => {
  let queryConfig: QueryConfig = {};
  let features: QueryFeature<TArgs>[] = [];

  const first = args[0];

  if (first) {
    if ('type' in first) {
      features = args as QueryFeature<TArgs>[];
    } else {
      [queryConfig, ...features] = args as [QueryConfig, ...QueryFeature<TArgs>[]];
    }
  }
  return { features, queryConfig };
};

export const createQueryCreator = <TArgs extends QueryArgs>(
  options: CreateQueryCreatorOptions | undefined,
  internals: InternalCreateQueryCreatorOptions<TArgs>,
): QueryCreator<TArgs> =>
  createBaseQueryCreator({
    options,
    internals,
    queryFactory: createQuery,
  });
