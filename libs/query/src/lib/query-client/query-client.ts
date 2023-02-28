import { BehaviorSubject } from 'rxjs';
import { AuthProvider } from '../auth';
import {
  BaseArguments,
  GqlQueryConfig,
  GqlQueryConfigWithoutMethod,
  isGqlQueryConfig,
  Query,
  QueryConfigWithoutMethod,
  RestQueryConfig,
  RouteType,
} from '../query';
import { QueryStore } from '../query-store';
import { buildRoute, Method as MethodType, RequestHeaders, RequestHeadersMethodMap } from '../request';
import {
  DefaultResponseTransformer,
  QueryClientConfig,
  QueryCreator,
  ResponseTransformerType,
} from './query-client.types';
import { buildGqlCacheKey, shouldCacheQuery } from './query-client.utils';

export class QueryClient {
  private readonly _store: QueryStore;

  get config() {
    return this._clientConfig;
  }

  get authProvider() {
    return this._authProvider$.getValue() ?? this._clientConfig.parent?._authProvider$.getValue() ?? null;
  }
  get authProvider$() {
    return this._authProvider$.asObservable() ?? this._clientConfig.parent?._authProvider$.asObservable() ?? null;
  }
  private readonly _authProvider$ = new BehaviorSubject<AuthProvider | null>(null);

  constructor(private _clientConfig: QueryClientConfig) {
    this._store = new QueryStore({
      enableChangeLogging: _clientConfig.logging?.queryStateChanges,
      enableGarbageCollectorLogging: _clientConfig.logging?.queryStateGarbageCollector,
    });
  }

  get = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    ResponseTransformer extends ResponseTransformerType<Response> = DefaultResponseTransformer<Response>,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, ResponseTransformer>,
  ) =>
    this.fetch<Route, Response, Arguments, 'GET', ResponseTransformer>({
      ...queryConfig,
      method: 'GET',
    });

  post = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    ResponseTransformer extends ResponseTransformerType<Response> = DefaultResponseTransformer<Response>,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, ResponseTransformer>,
  ) =>
    this.fetch<Route, Response, Arguments, 'POST', ResponseTransformer>({
      ...queryConfig,
      method: 'POST',
    });

  put = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    ResponseTransformer extends ResponseTransformerType<Response> = DefaultResponseTransformer<Response>,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, ResponseTransformer>,
  ) =>
    this.fetch<Route, Response, Arguments, 'PUT', ResponseTransformer>({
      ...queryConfig,
      method: 'PUT',
    });

  patch = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    ResponseTransformer extends ResponseTransformerType<Response> = DefaultResponseTransformer<Response>,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, ResponseTransformer>,
  ) =>
    this.fetch<Route, Response, Arguments, 'PATCH', ResponseTransformer>({
      ...queryConfig,
      method: 'PATCH',
    });

  delete = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    ResponseTransformer extends ResponseTransformerType<Response> = DefaultResponseTransformer<Response>,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, ResponseTransformer>,
  ) =>
    this.fetch<Route, Response, Arguments, 'DELETE', ResponseTransformer>({
      ...queryConfig,
      method: 'DELETE',
    });

  gqlQuery = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    ResponseTransformer extends ResponseTransformerType<Response> = DefaultResponseTransformer<Response>,
  >(
    queryConfig: GqlQueryConfigWithoutMethod<Route, Response, Arguments, ResponseTransformer>,
  ) =>
    this.fetch<Route, Response, Arguments, 'GQL_QUERY', ResponseTransformer>({
      ...queryConfig,
      method: 'GQL_QUERY',
    });

  gqlMutate = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    ResponseTransformer extends ResponseTransformerType<Response> = DefaultResponseTransformer<Response>,
  >(
    queryConfig: GqlQueryConfigWithoutMethod<Route, Response, Arguments, ResponseTransformer>,
  ) =>
    this.fetch<Route, Response, Arguments, 'GQL_MUTATE', ResponseTransformer>({
      ...queryConfig,
      method: 'GQL_MUTATE',
    });

  fetch = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined,
    Method extends MethodType,
    ResponseTransformer extends ResponseTransformerType<Response> = DefaultResponseTransformer<Response>,
  >(
    queryConfig:
      | RestQueryConfig<Route, Response, Arguments, ResponseTransformer>
      | GqlQueryConfig<Route, Response, Arguments, ResponseTransformer>,
  ): QueryCreator<Arguments, Method, Response, Route, ResponseTransformer> => {
    const prepare = (args?: Arguments) => {
      const route = buildRoute({
        base: this._clientConfig.baseRoute,
        route: queryConfig.route,
        pathParams: (args as BaseArguments)?.pathParams,
        queryParams: (args as BaseArguments)?.queryParams,
      }) as Route;

      const cacheKey = isGqlQueryConfig(queryConfig) ? buildGqlCacheKey(queryConfig, args) : route;

      if (shouldCacheQuery(queryConfig.method)) {
        const existingQuery = this._store.get(cacheKey);

        if (existingQuery) {
          if (existingQuery.isExpired) {
            existingQuery.execute();
          }

          return existingQuery as Query<Response, Arguments, Route, Method, ResponseTransformer>;
        }
      }

      const query = new Query<Response, Arguments, Route, Method, ResponseTransformer>(this, queryConfig, route, args);

      if (shouldCacheQuery(queryConfig.method)) {
        this._store.add(cacheKey, query);
      }

      return query;
    };

    const behaviorSubject = <T extends ReturnType<typeof prepare>>(initialValue: T | null = null) =>
      new BehaviorSubject<T | null>(initialValue);

    return {
      prepare,
      behaviorSubject,
    } as unknown as QueryCreator<Arguments, Method, Response, Route, ResponseTransformer>;
  };

  setAuthProvider = (authProvider: AuthProvider) => {
    if (this.authProvider) {
      throw new Error('The auth provider is already set. Please call clearAuthProvider() first.');
    }

    this._authProvider$.next(authProvider);
  };

  setDefaultHeaders = (config: {
    headers: RequestHeaders | RequestHeadersMethodMap | null;
    refreshQueriesInUse?: boolean;
  }) => {
    if (!this._clientConfig.request) {
      this._clientConfig.request = {
        headers: config.headers ?? undefined,
      };
    } else {
      this._clientConfig.request.headers = config.headers ?? undefined;
    }

    if (config.refreshQueriesInUse) {
      this._store.refreshQueriesInUse({ purgeUnused: true, ignoreCacheValidity: true });
    }
  };

  clearAuthProvider = () => {
    this.authProvider?.cleanUp();
    this._authProvider$.next(null);
  };
}
