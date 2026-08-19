import { Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { QueryForm } from '../../query-form';
import { EntityStore } from '../entity';
import { AnyLegacyQuery, AnyLegacyQueryCreator } from '../interop';
import { AnyV2QueryCreator, ConstructQuery, QueryDataOf, QueryResponseOf } from '../query-creator';
import { Method, PathParams, QueryParams, RequestError, RequestHeaders, RequestProgress } from '../request';
import { V2Query } from './query';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryAutoRefreshConfig = {
  /**
   * Refresh the query when the query client's headers change.
   * @default true
   */
  queryClientDefaultHeadersChange?: boolean;

  /**
   * Refresh the query when the window regains focus.
   *
   * This can only be disabled if `autoRefreshQueriesOnWindowFocus` is enabled on the query client.
   * @default true
   */
  windowFocus?: boolean;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type EntitySetParams<Store, Response, Arguments, Id> = {
  /**
   * The response data.
   */
  response: Response;

  /**
   * The id(s) returned by the `id` function.
   */
  id: Id;

  /**
   * The arguments passed to the query.
   */
  args: Arguments;

  /**
   * The entity store.
   */
  store: Store;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type EntityGetParams<Store, Response, Arguments, Id> = {
  /**
   * The response data.
   */
  response: Response;

  /**
   * The id(s) returned by the `id` function.
   */
  id: Id;

  /**
   * The arguments passed to the query.
   */
  args: Arguments;

  /**
   * The entity store.
   */
  store: Store;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type EntityIdParams<Response, Arguments> = {
  /**
   * The response data.
   */
  response: Response;

  /**
   * The arguments passed to the query.
   */
  args: Arguments;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryEntityConfig<Store, Data, Response, Arguments, Id> = {
  /**
   * The entity store to use for the query.
   */
  store: Store;

  /**
   * A function that returns the id of the entity. Can also return an array of ids.
   */
  id: (data: EntityIdParams<Response, Arguments>) => Id;

  /**
   * A function that returns the response data (can be a subset of the response).
   */
  get?: (data: EntityGetParams<Store, Response, Arguments, Id>) => Observable<Data>;

  /**
   * A function to update the entity store every time a new response is received.
   */
  set?: (data: EntitySetParams<Store, Response, Arguments, Id>) => void;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryConfigBase<
  Response,
  Arguments extends BaseArguments | undefined,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> = {
  /**
   * The http method to use for the query.
   */
  method: Method;

  /**
   * Determines if the auth provider should be used for this query.
   * The query **will throw** if the query client's auth provider is unset.
   */
  secure?: boolean;

  /**
   * Determines if the query should emit progress events.
   */
  reportProgress?: boolean;

  /**
   * Determines the query's response type.
   * @default 'json'
   */
  responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';

  /**
   * Whether this request should be sent with outgoing credentials (cookies).
   * @default false
   */
  withCredentials?: boolean;

  /**
   * Configuration for handling auto refresh triggers.
   *
   * **Note:** This is only available for queries that can be refreshed. (`GET`, `HEAD`, `OPTIONS`, `GQL_QUERY`)
   */
  autoRefreshOn?: QueryAutoRefreshConfig;

  /**
   * Whether to automatically stop polling for this query when the window loses focus.
   * Polling will resume when the window regains focus.
   *
   * This can only be disabled if `enableSmartPolling` is enabled on the query client.
   * @default true
   */
  enableSmartPolling?: boolean;

  /**
   * Object containing the query's type information.
   */
  types?: {
    /**
     * The type of the successful response.
     */
    response?: Response;

    /**
     * Arguments for executing the query.
     *
     * - `pathParams`: The path parameters for the query. (in front of the ? in the url)
     * - `queryParams`: The query parameters for the query. (after the ? in the url)
     * - `body`: The body for the query. Unavailable for GET, HEAD and OPTIONS requests.
     * - `headers`: The headers for the query.
     * - `variables`: The variables for the query. (graphql only)
     */
    args?: Arguments;
  };

  /**
   * Object containing the query's entity store information.
   */
  entity?: QueryEntityConfig<Store, Data, Response, Arguments, Id>;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type RestQueryConfig<
  Route extends V2RouteType<Arguments>,
  Response,
  Arguments extends BaseArguments | undefined,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> = QueryConfigBase<Response, Arguments, Store, Data, Id> & {
  /**
   * The api route to use for the query.
   */
  route: Route;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type GqlTransferOption = 'GET' | 'POST';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type GqlQueryConfig<
  Route extends V2RouteType<Arguments> | undefined,
  Response,
  Arguments extends BaseArguments | undefined,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> = QueryConfigBase<Response, Arguments, Store, Data, Id> & {
  /**
   * The graphql query to use for the query.
   */
  query: string;

  /**
   * Determines if the query should be sent via GET or POST.
   * - `GET`: The query will be sent via query parameters.
   * - `POST`: The query will be sent via the body.
   * @default 'POST'
   */
  transferVia?: GqlTransferOption;

  /**
   * Subroute to use for the query.
   */
  route?: Route;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRestQueryConfig = RestQueryConfig<any, any, any, any, any, any>;
/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGqlQueryConfig = GqlQueryConfig<any, any, any, any, any, any>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryConfigWithoutMethod<
  Route extends V2RouteType<Arguments>,
  Response,
  Arguments extends BaseArguments | undefined,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> = Omit<RestQueryConfig<Route, Response, Arguments, Store, Data, Id>, 'method'>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type GqlQueryConfigWithoutMethod<
  Route extends V2RouteType<Arguments>,
  Response,
  Arguments extends BaseArguments | undefined,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> = Omit<GqlQueryConfig<Route, Response, Arguments, Store, Data, Id>, 'method'>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type BaseArguments = WithHeaders &
  WithVariables &
  WithBody &
  WithQueryParams &
  WithPathParams &
  WithMock<unknown>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type WithHeaders = {
  /**
   * The headers to send with the query.
   */
  headers?: Record<string, string>;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryMockConfig<MockResponse> = {
  /**
   * The mock response to use for the query.
   */
  response?: MockResponse;

  /**
   * The mock error to use for the query.
   */
  error?: RequestError;

  /**
   * The delay in milliseconds to wait before resolving the mock.
   * If progress is enabled, the delay will be used for each progress event.
   * @default 200
   */
  delay?: number;

  /**
   * Whether to report progress for the mock.
   * For testing e.g. file uploads.
   */
  progress?: {
    /**
     * The number of progress events to report.
     * @default 5
     */
    eventCount?: number;

    /**
     * The type of progress event to report.
     * @default 'upload'
     */
    eventType?: 'download' | 'upload';

    /**
     * The total size of the file to report progress for in bytes.
     * @default 1_000_000 (1MB)
     */
    fileSize?: number;

    /**
     * If true, the total size of the file will be omitted from the progress event.
     * Useful for testing e.g. download progress when the server does not provide a total size.
     */
    omitTotal?: boolean;

    /**
     * If true, the partial text will be omitted from the progress event.
     * Useful for testing e.g. download progress when the server does not provide a partial text.
     */
    omitPartialText?: boolean;
  };

  /**
   * This will mock the request failing and getting retried 3 times. After, the request will succeed with the provided response.
   * Can not be used with `progress` enabled.
   * @default false
   */
  retryIntoResponse?: boolean;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type WithMock<MockResponse> = {
  mock?: QueryMockConfig<MockResponse>;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type V2QueryConfig = {
  /**
   * Whether this query should be added to the internal query store.
   *
   * Generally this should be left on `false` unless you know what you are doing.
   * @default false
   */
  skipQueryStore?: boolean;

  /**
   * The cache key to use for this query.
   * Useful for queries that are equal but should be stored separately.
   * Will be generated automatically if not provided.
   *
   * Generally this should be left on `undefined` unless you know what you are doing.
   */
  queryStoreCacheKey?: string;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type WithConfig = {
  /**
   * Additional configuration for this query.
   */
  config?: V2QueryConfig;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type WithInjector = {
  injector?: Injector;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type WithVariables = {
  /**
   * The variables for the query. (graphql only)
   */
  variables?: Record<string, unknown>;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type WithBody = {
  /**
   * The body for the query. Unavailable for GET, HEAD and OPTIONS requests.
   */
  body?: unknown;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type WithQueryParams = {
  /**
   * The query parameters for the query. (after the ? in the url)
   */
  queryParams?: QueryParams;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type WithPathParams = {
  /**
   * The path parameters for the query. (in front of the ? in the url)
   */
  pathParams?: PathParams;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryTrigger = 'program' | 'poll' | 'auto';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type EmptyObject = {};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type ExecuteQueryOptions = {
  /**
   * Whether to skip the cache for this query. This will force the query to be executed. It might still be caught by the native browser cache.
   * @default false
   */
  skipCache?: boolean;

  /**
   * Whether to cancel the previous request if it is still loading.
   * @default false
   */
  cancelPrevious?: boolean;

  /**
   * The trigger type for this query.
   * - `program`: The query was triggered by the user.
   * - `poll`: The query was triggered by polling.
   * - `auto`: The query was triggered by an auto refresh event.
   * @default 'program'
   * @internal
   */
  _triggeredVia?: QueryTrigger;

  /**
   * Whether this is a retry of an unauthorized request.
   * @internal
   */
  _isUnauthorizedRetry?: boolean;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type V2RouteType<Arguments extends BaseArguments | undefined> = Arguments extends {
  pathParams: infer PathParams;
}
  ? (p: PathParams) => V2RouteString
  : V2RouteString;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type V2RouteString = `/${string}`;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type AnyRoute = ((p: PathParams) => string) | V2RouteString;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type PollConfig = {
  /**
   * The interval in milliseconds to poll the query.
   */
  interval: number;

  /**
   * A observable that will stop the polling when it emits.
   */
  takeUntil: Observable<unknown>;

  /**
   * Whether to trigger the query immediately after polling starts.
   */
  triggerImmediately?: boolean;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const QueryStateType = {
  Prepared: 'PREPARED',
  Loading: 'LOADING',
  Success: 'SUCCESS',
  Failure: 'FAILURE',
  Cancelled: 'CANCELLED',
} as const;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryStateType = (typeof QueryStateType)[keyof typeof QueryStateType];

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type Prepared = {
  type: typeof QueryStateType.Prepared;
  meta: QueryStateMeta;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type Success<Response = unknown> = {
  type: typeof QueryStateType.Success;
  response: Response;
  headers: RequestHeaders;
  meta: QueryStateSuccessMeta;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type Failure = {
  type: typeof QueryStateType.Failure;
  error: RequestError;
  meta: QueryStateMeta;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type Loading = {
  type: typeof QueryStateType.Loading;
  meta: QueryStateMeta;
  partialText?: string;
  progress?: RequestProgress;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type Cancelled = {
  type: typeof QueryStateType.Cancelled;
  meta: QueryStateMeta;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryStateMeta = {
  id: number;
  triggeredVia: QueryTrigger;
  isWaitingForRetry?: boolean;
  retryNumber?: number;
  retryDelay?: number;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryStateSuccessMeta = QueryStateMeta & {
  expiresAt?: number;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type V2QueryState<Response = unknown> = Loading | Success<Response> | Failure | Cancelled | Prepared;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryStateResponseOf<T extends V2QueryState = V2QueryState> =
  T extends Success<infer Response> ? Response : never;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyV2Query = V2Query<any, any, any, any, any, any>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type AnyQueryCreatorCollection = { [name: string]: AnyV2QueryCreator | AnyLegacyQueryCreator };

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryCollectionOf<T extends { [name: string]: AnyV2QueryCreator | AnyLegacyQueryCreator }> = {
  [K in keyof T]: { type: K; query: ConstructQuery<T[K]> };
}[keyof T];

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type AnyQueryCollection = { type: string; query: AnyV2Query | AnyLegacyQuery };

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryOf<T extends AnyQueryCollection | AnyLegacyQuery | AnyV2Query | null> = T extends AnyV2Query
  ? T
  : T extends AnyLegacyQuery
    ? T
    : T extends AnyQueryCollection
      ? T['query']
      : never;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type AnyQueryCollectionResponse<T extends AnyQueryCollection> = QueryResponseOf<T['query']>;
/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type AnyQueryCollectionData<T extends AnyQueryCollection> = QueryDataOf<T['query']>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryCollectionKeysOf<T extends AnyQueryCollection | AnyLegacyQuery | AnyV2Query | null> =
  T extends AnyQueryCollection ? T['type'] : never;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryCollectionWithNullableQuery<T extends AnyQueryCollection | null> = T extends null
  ? never
  : {
      [K in keyof T]: T[K] extends string ? T[K] : T[K] | null;
    };

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResetPageOnErrorOperatorConfig<J extends QueryForm<any>> = {
  /**
   * The query form to reset the page of.
   */
  queryForm: J;

  /**
   * The key of the page control in the query form.
   * @default 'page'
   */
  pageControlKey?: string;
};
