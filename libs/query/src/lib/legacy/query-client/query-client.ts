import { BehaviorSubject } from 'rxjs';
import { AuthProvider } from '../auth';
import { EntityStore } from '../entity';
import {
  BaseArguments,
  GqlQueryConfig,
  GqlQueryConfigWithoutMethod,
  QueryConfigWithoutMethod,
  RestQueryConfig,
  V2RouteType,
} from '../query';
import { V2QueryCreator } from '../query-creator';
import { QueryStore } from '../query-store';
import { RequestHeaders, RequestHeadersMethodMap } from '../request';
import { V2QueryClientConfig } from './query-client.types';

export class V2QueryClient {
  /**
   * @internal
   */
  readonly _store: QueryStore;

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

  constructor(private _clientConfig: V2QueryClientConfig) {
    this._store = new QueryStore({
      enableChangeLogging: _clientConfig.logging?.queryStateChanges,
      enableGarbageCollectorLogging: _clientConfig.logging?.queryStateGarbageCollector,
      autoRefreshQueriesOnWindowFocus: _clientConfig.request?.autoRefreshQueriesOnWindowFocus ?? true,
      enableSmartPolling: _clientConfig.request?.enableSmartPolling ?? true,
    });
  }

  get = <
    Route extends V2RouteType<Arguments>,
    Response,
    Id,
    Data = Response,
    Arguments extends BaseArguments | undefined = undefined,
    Store extends EntityStore<unknown> = EntityStore<unknown>,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, Store, Data, Id>,
  ) =>
    this.fetch<Route, Response, Arguments, Id, Store, Data>({
      ...queryConfig,
      method: 'GET',
    });

  post = <
    Route extends V2RouteType<Arguments>,
    Response,
    Id,
    Data = Response,
    Arguments extends BaseArguments | undefined = undefined,
    Store extends EntityStore<unknown> = EntityStore<unknown>,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, Store, Data, Id>,
  ) =>
    this.fetch<Route, Response, Arguments, Id, Store, Data>({
      ...queryConfig,
      method: 'POST',
    });

  put = <
    Route extends V2RouteType<Arguments>,
    Response,
    Id,
    Data = Response,
    Arguments extends BaseArguments | undefined = undefined,
    Store extends EntityStore<unknown> = EntityStore<unknown>,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, Store, Data, Id>,
  ) =>
    this.fetch<Route, Response, Arguments, Id, Store, Data>({
      ...queryConfig,
      method: 'PUT',
    });

  patch = <
    Route extends V2RouteType<Arguments>,
    Response,
    Id,
    Data = Response,
    Arguments extends BaseArguments | undefined = undefined,
    Store extends EntityStore<unknown> = EntityStore<unknown>,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, Store, Data, Id>,
  ) =>
    this.fetch<Route, Response, Arguments, Id, Store, Data>({
      ...queryConfig,
      method: 'PATCH',
    });

  delete = <
    Route extends V2RouteType<Arguments>,
    Response,
    Id,
    Data = Response,
    Arguments extends BaseArguments | undefined = undefined,
    Store extends EntityStore<unknown> = EntityStore<unknown>,
  >(
    queryConfig: QueryConfigWithoutMethod<Route, Response, Arguments, Store, Data, Id>,
  ) =>
    this.fetch<Route, Response, Arguments, Id, Store, Data>({
      ...queryConfig,
      method: 'DELETE',
    });

  gqlQuery = <
    Route extends V2RouteType<Arguments>,
    Response,
    Id,
    Data = Response,
    Arguments extends BaseArguments | undefined = undefined,
    Store extends EntityStore<unknown> = EntityStore<unknown>,
  >(
    queryConfig: GqlQueryConfigWithoutMethod<Route, Response, Arguments, Store, Data, Id>,
  ) =>
    this.fetch<Route, Response, Arguments, Id, Store, Data>({
      ...queryConfig,
      method: 'GQL_QUERY',
    });

  gqlMutate = <
    Route extends V2RouteType<Arguments>,
    Response,
    Id,
    Data = Response,
    Arguments extends BaseArguments | undefined = undefined,
    Store extends EntityStore<unknown> = EntityStore<unknown>,
  >(
    queryConfig: GqlQueryConfigWithoutMethod<Route, Response, Arguments, Store, Data, Id>,
  ) =>
    this.fetch<Route, Response, Arguments, Id, Store, Data>({
      ...queryConfig,
      method: 'GQL_MUTATE',
    });

  fetch = <
    Route extends V2RouteType<Arguments>,
    Response,
    Arguments extends BaseArguments | undefined,
    Id,
    Store extends EntityStore<unknown> = EntityStore<unknown>,
    Data = Response,
  >(
    queryConfig:
      | RestQueryConfig<Route, Response, Arguments, Store, Data, Id>
      | GqlQueryConfig<Route, Response, Arguments, Store, Data, Id>,
  ) => new V2QueryCreator<Arguments, Response, Route, Store, Data, Id>(queryConfig, this, this._store);

  setAuthProvider = (authProvider: AuthProvider) => {
    if (this.authProvider) {
      this.authProvider?.cleanUp();
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

  _updateBaseRoute = (route: string) => {
    this._clientConfig.baseRoute = route;
  };
}
