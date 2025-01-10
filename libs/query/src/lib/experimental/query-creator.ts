import { HttpRequestResponseType, HttpRequestTransferCacheConfig } from './http-request';
import { AnyQuery, PathParamsType, Query, QueryArgs, createQuery } from './query';
import { QueryClientConfig } from './query-client-config';
import { QueryFeature } from './query-features';

export type RouteType<TArgs extends QueryArgs> =
  PathParamsType<TArgs> extends { [key: string]: string } ? (args: TArgs['pathParams']) => RouteString : RouteString;

export type RouteString = `/${string}`;

export type CreateQueryCreatorOptions<TArgs extends QueryArgs> = {
  /**
   * The route of the query.
   * If the query has path params, the route should be a function that takes the path params as an argument.
   * Otherwise, it should be a string.
   */
  route: RouteType<TArgs>;

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
};

export type QueryCreator<TArgs extends QueryArgs> = {
  (...features: QueryFeature<TArgs>[]): Query<TArgs>;
  (queryConfig: QueryConfig, ...features: QueryFeature<TArgs>[]): Query<TArgs>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyQueryCreator = QueryCreator<any>;

export type QueryArgsOf<T extends AnyQueryCreator | AnyQuery> =
  T extends QueryCreator<infer TArgs> ? TArgs : T extends Query<infer TArgs> ? TArgs : never;

export type RunQueryCreator<TCreator extends AnyQueryCreator> = ReturnType<TCreator>;

export type QueryMethod = 'GET' | 'OPTIONS' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'TRACE' | 'CONNECT';

export type InternalCreateQueryCreatorOptions = {
  method: QueryMethod;
  client: QueryClientConfig;
};

export type QueryConfig = {
  /** A custom id to use for this query. Only affects queries that can be cached. */
  key?: string;

  /**
   * If true, the query will not be executed automatically.
   * Does not affect mutations such as POST, PUT etc. since those are never executed automatically.
   */
  onlyManualExecution?: boolean;
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
  options: CreateQueryCreatorOptions<TArgs>,
  internals: InternalCreateQueryCreatorOptions,
): QueryCreator<TArgs> => {
  function queryCreator(...features: QueryFeature<TArgs>[]): Query<TArgs>;
  function queryCreator(queryConfig: QueryConfig, ...features: QueryFeature<TArgs>[]): Query<TArgs>;

  function queryCreator(...args: (QueryFeature<TArgs> | QueryConfig)[]): Query<TArgs> {
    const { features, queryConfig } = splitQueryConfig<TArgs>(args);

    return createQuery<TArgs>({
      creator: options,
      creatorInternals: internals,
      features,
      queryConfig,
    });
  }

  return queryCreator;
};
