import { GqlTransferOption } from '../query/query.types';
import {
  BuildQueryStringConfig,
  CacheAdapterFn,
  RequestHeaders,
  RequestHeadersMethodMap,
  RequestRetryFn,
} from '../request';
import { QueryClient } from './query-client';

export interface QueryClientConfig {
  /**
   * The api base route. Should **not** end with a trailing slash.
   * @example 'https://api.example.com'
   */
  baseRoute: string;

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

    /**
     * Log if subscriptions are made to queries that are in the `prepared` state.
     * This usually indicates that the `.execute()` method was forgotten.
     */
    preparedQuerySubscriptions?: boolean;
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

    /**
     * Configuration options for all graphql queries.
     */
    gql?: {
      /**
       * Determines if the query should be sent via GET or POST.
       * - `GET`: The query will be sent via query parameters.
       * - `POST`: The query will be sent via the body.
       * @default 'POST'
       */
      transferVia?: GqlTransferOption;
    };

    /**
     * Configuration options for all query strings.
     */
    queryParams?: BuildQueryStringConfig;
  };

  /**
   * Parent query client.
   * Used for sharing the same auth provider.
   */
  parent?: QueryClient;
}
