import { Observable } from 'rxjs';
import { EntityKey, EntityStore } from '../entity';
import { AnyQueryCreator, QueryCreatorReturnType } from '../query-creator';
import { Method, PathParams, QueryParams, RequestError, RequestProgress } from '../request';
import { Query } from './query';

export interface QueryAutoRefreshConfig {
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
}

export interface EntitySetParams<Entity, Response, Arguments extends BaseArguments | undefined> {
  response: Response;
  id: EntityKey | EntityKey[];
  args: Arguments;
  store: EntityStore<Entity>;
}

export interface EntityGetParams<Entity, Response, Arguments extends BaseArguments | undefined> {
  response: Response;
  id: EntityKey | EntityKey[];
  args: Arguments;
  store: EntityStore<Entity>;
}

export interface EntityIdParams<Response, Arguments extends BaseArguments | undefined> {
  response: Response;
  args: Arguments;
}

export interface QueryEntityConfig<Entity, Response, Arguments extends BaseArguments | undefined> {
  store: EntityStore<Entity>;
  id: (data: EntityIdParams<Response, Arguments>) => EntityKey | EntityKey[];
  get?: (data: EntityGetParams<Entity, Response, Arguments>) => Observable<Response | null>;
  set?: (data: EntitySetParams<Entity, Response, Arguments>) => void;
}

export type QueryConfigBase<Response, Arguments extends BaseArguments | undefined, Entity> = {
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

  entity?: QueryEntityConfig<Entity, Response, Arguments>;
};

export type RestQueryConfig<
  Route extends RouteType<Arguments>,
  Response,
  Arguments extends BaseArguments | undefined,
  Entity,
> = QueryConfigBase<Response, Arguments, Entity> & {
  /**
   * The api route to use for the query.
   */
  route: Route;
};

export type GqlTransferOption = 'GET' | 'POST';

export interface GqlQueryConfig<
  Route extends RouteType<Arguments> | undefined,
  Response,
  Arguments extends BaseArguments | undefined,
  Entity,
> extends QueryConfigBase<Response, Arguments, Entity> {
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRestQueryConfig = RestQueryConfig<any, any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGqlQueryConfig = GqlQueryConfig<any, any, any, any>;

export type QueryConfigWithoutMethod<
  Route extends RouteType<Arguments>,
  Response,
  Arguments extends BaseArguments | undefined,
  Entity,
> = Omit<RestQueryConfig<Route, Response, Arguments, Entity>, 'method'>;

export type GqlQueryConfigWithoutMethod<
  Route extends RouteType<Arguments>,
  Response,
  Arguments extends BaseArguments | undefined,
  Entity,
> = Omit<GqlQueryConfig<Route, Response, Arguments, Entity>, 'method'>;

export type BaseArguments = WithHeaders & WithVariables & WithBody & WithQueryParams & WithPathParams;

export interface WithHeaders {
  headers?: Record<string, string>;
}

export interface WithVariables {
  variables?: Record<string, unknown>;
}

export interface WithBody {
  body?: unknown;
}

export interface WithQueryParams {
  queryParams?: QueryParams;
}

export interface WithPathParams {
  pathParams?: PathParams;
}

export type QueryTrigger = 'program' | 'poll' | 'auto';

// eslint-disable-next-line @typescript-eslint/ban-types
export type EmptyObject = {};

export interface RunQueryOptions {
  /**
   * Whether to skip the cache for this query. This will force the query to be executed. It might still be caught by the native browser cache.
   * @default false
   */
  skipCache?: boolean;

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
}

export type RouteType<Arguments extends BaseArguments | undefined> = Arguments extends {
  pathParams: infer PathParams;
}
  ? (p: PathParams) => RouteString
  : RouteString;

export type RouteString = `/${string}`;

export interface PollConfig {
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
}

export const enum QueryStateType {
  Prepared = 'PREPARED',
  Loading = 'LOADING',
  Success = 'SUCCESS',
  Failure = 'FAILURE',
  Cancelled = 'CANCELLED',
}

export interface Prepared {
  type: QueryStateType.Prepared;
  meta: QueryStateMeta;
}

export interface Success<Response = unknown> {
  type: QueryStateType.Success;
  response: Response;
  meta: QueryStateSuccessMeta;
}

export interface Failure {
  type: QueryStateType.Failure;
  error: RequestError;
  meta: QueryStateMeta;
}

export interface Loading {
  type: QueryStateType.Loading;
  meta: QueryStateMeta;
  partialText?: string;
  progress?: RequestProgress;
}

export interface Cancelled {
  type: QueryStateType.Cancelled;
  meta: QueryStateMeta;
}

export interface QueryStateMeta {
  id: number;
  triggeredVia: QueryTrigger;
  isWaitingForRetry?: boolean;
  retryNumber?: number;
  retryDelay?: number;
}

export interface QueryStateSuccessMeta extends QueryStateMeta {
  expiresAt?: number;
}

export type QueryState<Response = unknown> = Loading | Success<Response> | Failure | Cancelled | Prepared;

export type QueryStateData<T extends QueryState = QueryState> = T extends Success<infer Response> ? Response : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyQuery = Query<any, any, any, any, any>;

export type QueryType<
  T extends {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prepare: (args: any) => AnyQuery;
  },
> = T['prepare'] extends () => infer R
  ? R
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T['prepare'] extends (args: any) => infer R
  ? R
  : never;

export type QueryResponseType<Q extends AnyQuery | null> = Q extends AnyQuery
  ? QueryStateData<Q['state']> | null
  : null;

export type AnyQueryCreatorCollection = { [name: string]: AnyQueryCreator };

export type AnyQueryOfCreatorCollection<T extends { [name: string]: AnyQueryCreator }> = {
  [K in keyof T]: { type: K; query: QueryCreatorReturnType<T[K]> };
}[keyof T];

export type QueryOf<T extends AnyQueryOfCreatorCollection<AnyQueryCreatorCollection> | AnyQuery | null> =
  T extends AnyQuery ? T : T extends AnyQueryOfCreatorCollection<AnyQueryCreatorCollection> ? T['query'] : never;

export type AnyQueryResponseOfCreatorCollection<T extends AnyQueryOfCreatorCollection<AnyQueryCreatorCollection>> =
  QueryResponseType<T['query']>;
