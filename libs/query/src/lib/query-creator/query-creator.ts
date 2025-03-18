import { assertInInjectionContext, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject } from 'rxjs';
import { EntityStore } from '../entity';
import { Query, computeQueryQueryParams } from '../query';
import { QueryClient, buildQueryCacheKey, shouldCacheQuery } from '../query-client';
import { QueryStore } from '../query-store';
import {
  AnyRoute,
  BaseArguments,
  GqlQueryConfig,
  RestQueryConfig,
  RouteType,
  WithConfig,
  WithHeaders,
  WithMock,
} from '../query/query.types';
import { buildRoute } from '../request';
import { QueryContainerConfig, addQueryContainerHandling } from '../utils';
import { QueryPrepareFn } from './query-creator.types';

export class QueryCreator<
  Arguments extends BaseArguments | undefined,
  Response,
  Route extends RouteType<Arguments>,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> {
  constructor(
    private _queryConfig:
      | RestQueryConfig<Route, Response, Arguments, Store, Data, Id>
      | GqlQueryConfig<Route, Response, Arguments, Store, Data, Id>,
    private _client: QueryClient,
    private _store: QueryStore,
  ) {}

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  prepare: QueryPrepareFn<Arguments, Response, Route, Store, Data, Id> = (
    args?: Arguments & WithHeaders & WithConfig & WithMock<Response>,
  ) => {
    const route = buildRoute({
      base: this._client.config.baseRoute,
      route: this._queryConfig.route as AnyRoute,
      pathParams: args?.pathParams,
      queryParams: computeQueryQueryParams({ config: this._queryConfig, client: this._client, args }),
      queryParamConfig: this._client.config.request?.queryParams,
    }) as Route;

    const cacheKey = (args?.config?.queryStoreCacheKey ?? '') + buildQueryCacheKey(route as string, args);

    if (shouldCacheQuery(this._queryConfig.method) && !args?.config?.skipQueryStore) {
      const existingQuery = this._store.get<Query<Response, Arguments, Route, Store, Data, Id>>(cacheKey);

      if (existingQuery) {
        return existingQuery;
      }
    }

    const query = new Query<Response, Arguments, Route, Store, Data, Id>(
      this._client,
      this._queryConfig,
      route,
      args ?? ({} as Arguments),
      cacheKey,
    );

    if (shouldCacheQuery(this._queryConfig.method) && !args?.config?.skipQueryStore) {
      this._store.add(cacheKey, query);
    }

    this._store._dispatchQueryCreated(query);

    return query;
  };

  createSubject = (initialValue?: ReturnType<typeof this.prepare> | null, config?: QueryContainerConfig) => {
    assertInInjectionContext(this.createSubject);

    const subject = new BehaviorSubject<ReturnType<typeof this.prepare> | null>(initialValue ?? null);

    addQueryContainerHandling(subject, () => subject.getValue(), config);

    return subject;
  };

  createSignal = (initialValue?: ReturnType<typeof this.prepare> | null, config?: QueryContainerConfig) => {
    assertInInjectionContext(this.createSignal);

    const _signal = signal<ReturnType<typeof this.prepare> | null>(initialValue ?? null);

    addQueryContainerHandling(toObservable(_signal), () => _signal(), config);

    return _signal;
  };

  /**
   * @deprecated Use `myQuery.createSubject()` or `myQuery.createSignal()` instead. Will be removed in v6.
   */
  behaviorSubject = (initialValue?: ReturnType<typeof this.prepare> | null) =>
    new BehaviorSubject<ReturnType<typeof this.prepare> | null>(initialValue ?? null);
}
