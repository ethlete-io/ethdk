import { BehaviorSubject } from 'rxjs';
import { AuthProvider } from '../auth';
import {
  BaseArguments,
  GqlQueryConfig,
  GqlQueryConfigWithoutMethod,
  QueryConfigWithoutMethod,
  RestQueryConfig,
  RouteType,
} from '../query';
import { QueryCreator } from '../query-creator';
import { QueryStore } from '../query-store';
import { Method as MethodType, RequestHeaders, RequestHeadersMethodMap } from '../request';
import { QueryClientConfig } from './query-client.types';

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
      autoRefreshQueriesOnWindowFocus: _clientConfig.request?.autoRefreshQueriesOnWindowFocus ?? true,
      enableSmartPolling: _clientConfig.request?.enableSmartPolling ?? true,
    });
  }

  get = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    Entity = unknown,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, Entity>,
  ) =>
    this.fetch<Route, Response, Arguments, 'GET', Entity>({
      ...queryConfig,
      method: 'GET',
    });

  post = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    Entity = unknown,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, Entity>,
  ) =>
    this.fetch<Route, Response, Arguments, 'POST', Entity>({
      ...queryConfig,
      method: 'POST',
    });

  put = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    Entity = unknown,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, Entity>,
  ) =>
    this.fetch<Route, Response, Arguments, 'PUT', Entity>({
      ...queryConfig,
      method: 'PUT',
    });

  patch = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    Entity = unknown,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, Entity>,
  ) =>
    this.fetch<Route, Response, Arguments, 'PATCH', Entity>({
      ...queryConfig,
      method: 'PATCH',
    });

  delete = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    Entity = unknown,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, Entity>,
  ) =>
    this.fetch<Route, Response, Arguments, 'DELETE', Entity>({
      ...queryConfig,
      method: 'DELETE',
    });

  gqlQuery = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    Entity = unknown,
  >(
    queryConfig: GqlQueryConfigWithoutMethod<Route, Response, Arguments, Entity>,
  ) =>
    this.fetch<Route, Response, Arguments, 'GQL_QUERY', Entity>({
      ...queryConfig,
      method: 'GQL_QUERY',
    });

  gqlMutate = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined = undefined,
    Entity = unknown,
  >(
    queryConfig: GqlQueryConfigWithoutMethod<Route, Response, Arguments, Entity>,
  ) =>
    this.fetch<Route, Response, Arguments, 'GQL_MUTATE', Entity>({
      ...queryConfig,
      method: 'GQL_MUTATE',
    });

  fetch = <
    Route extends RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined,
    Method extends MethodType,
    Entity = unknown,
  >(
    queryConfig:
      | RestQueryConfig<Route, Response, Arguments, Entity>
      | GqlQueryConfig<Route, Response, Arguments, Entity>,
  ) => new QueryCreator<Arguments, Method, Response, Route, Entity>(queryConfig, this, this._store);

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
