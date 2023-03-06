/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorSubject } from 'rxjs';
import { Query } from '../query/query';
import { BaseArguments, EmptyObject, RouteType, WithHeaders, WithUseResultIn } from '../query/query.types';
import {
  CacheAdapterFn,
  Method as MethodType,
  RequestHeaders,
  RequestHeadersMethodMap,
  RequestRetryFn,
} from '../request';
import { QueryClient } from './query-client';

export interface QueryClientConfig {
  /**
   * The api base route.
   * @example 'https://api.example.com'
   */
  baseRoute: `https://${string}` | `http://localhost:${string}`;

  /**
   * Logging configuration for debugging.
   */
  logging?: {
    /**
     * Log all query state changes.
     */
    queryStateChanges?: boolean;

    /**
     * Log query state garbage collector runs.
     */
    queryStateGarbageCollector?: boolean;
  };

  /**
   * Request options.
   */
  request?: {
    /**
     * Adapter function used for extracting the time until the response is invalid.
     * The default uses the `cache-control` (`max-age` & `s-maxage`), `age` and `expires` headers.
     * Should return a number in seconds.
     */
    cacheAdapter?: CacheAdapterFn;

    /**
     * Default headers to be sent with every request.
     * Will be overridden by headers passed to the query.
     * Do not include the `Authorization` header here. Use an `AuthProvider` instead.
     */
    headers?: RequestHeaders | RequestHeadersMethodMap;

    /**
     * Whether to automatically refresh expired queries when the window regains focus.
     * @default true
     */
    autoRefreshQueriesOnWindowFocus?: boolean;

    /**
     * Whether to automatically stop polling queries when the window loses focus.
     * Polling will resume when the window regains focus.
     * @default true
     */
    enableSmartPolling?: boolean;

    /**
     * A retry function to be used for all queries.
     * @default shouldRetryRequest()
     */
    retryFn?: RequestRetryFn;
  };

  /**
   * Parent query client.
   * Used for sharing the same auth provider.
   */
  parent?: QueryClient;
}

export type QueryCreator<
  Arguments extends BaseArguments | undefined,
  Method extends MethodType,
  Response,
  Route extends RouteType<Arguments>,
  ResponseTransformer extends ResponseTransformerType<Response> = DefaultResponseTransformer<Response>,
> = (Arguments extends BaseArguments
  ? {
      prepare: (
        args: Arguments & WithHeaders & WithUseResultIn<Response, ResponseTransformer>,
      ) => Query<Response, Arguments, Route, Method, ResponseTransformer>;
    }
  : {
      prepare: (
        args?: (Arguments extends EmptyObject ? Arguments : EmptyObject) &
          WithHeaders &
          WithUseResultIn<Response, ResponseTransformer>,
      ) => Query<Response, Arguments, Route, Method, ResponseTransformer>;
    }) & {
  behaviorSubject: <T extends Query<Response, Arguments, Route, Method, ResponseTransformer>>(
    initialValue?: T | null,
  ) => BehaviorSubject<T | null>;
};

export type AnyQueryCreator = QueryCreator<any, any, any, any, any>;

export type QueryCreatorArgs<T extends AnyQueryCreator> = T extends QueryCreator<infer Args, any, any, any, any>
  ? Args
  : never;

export type QueryCreatorMethod<Q extends AnyQueryCreator> = Q extends QueryCreator<any, infer Method, any, any, any>
  ? Method
  : never;

export type QueryCreatorResponse<T extends AnyQueryCreator> = T extends QueryCreator<any, any, infer Response, any, any>
  ? Response
  : never;

export type QueryCreatorRoute<Q extends AnyQueryCreator> = Q extends QueryCreator<infer Args, any, any, any, any>
  ? RouteType<Args>
  : never;

export type QueryCreatorResponseTransformer<Q extends AnyQueryCreator> = Q extends QueryCreator<
  any,
  any,
  any,
  any,
  infer ResponseTransformer
>
  ? ResponseTransformer
  : never;

export type ResponseTransformerType<Response> = (response: Response) => unknown;
export type DefaultResponseTransformer<Response> = (response: Response) => Response;

export type QueryCreatorReturnType<T extends AnyQueryCreator> = ReturnType<T['prepare']>;
