import { Injector, assertInInjectionContext, inject } from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { pairwise, startWith, takeUntil, tap } from 'rxjs';
import { EntityStore } from '../entity';
import { Query, computeQueryQueryParams, isGqlQueryConfig } from '../query';
import { QueryClient, buildGqlCacheKey, shouldCacheQuery } from '../query-client';
import { QueryStore } from '../query-store';
import { BaseArguments, GqlQueryConfig, RestQueryConfig, RouteType, WithHeaders } from '../query/query.types';
import { buildRoute } from '../request';
import { QueryContainerConfig, QuerySubject, querySignal } from '../utils';
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
  prepare: QueryPrepareFn<Arguments, Response, Route, Store, Data, Id> = (args?: Arguments & WithHeaders) => {
    const route = buildRoute({
      base: this._client.config.baseRoute,
      route: this._queryConfig.route,
      pathParams: args?.pathParams,
      queryParams: computeQueryQueryParams({ config: this._queryConfig, client: this._client, args }),
      queryParamConfig: this._client.config.request?.queryParams,
    }) as Route;

    const cacheKey = isGqlQueryConfig(this._queryConfig) ? buildGqlCacheKey(this._queryConfig, args) : route;

    if (shouldCacheQuery(this._queryConfig.method)) {
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
    );

    if (shouldCacheQuery(this._queryConfig.method)) {
      this._store.add(cacheKey, query);
    }

    this._store._dispatchQueryCreated(query);

    return query;
  };

  createSubject = (initialValue?: ReturnType<typeof this.prepare> | null, config?: QueryContainerConfig) => {
    assertInInjectionContext(this.createSubject);

    const injector = inject(Injector);
    const destroy$ = createDestroy();
    const subject = new QuerySubject<ReturnType<typeof this.prepare> | null>(initialValue ?? null, config);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tNode = (injector as any)._tNode;
    const componentId = tNode?.index ?? -1;

    subject
      .pipe(
        takeUntil(destroy$),
        pairwise(),
        startWith([null, subject.value]),
        tap(([prevQuery, currQuery]) => {
          prevQuery?._removeDependent(componentId);
          currQuery?._addDependent(componentId);

          if (config?.abortPrevious && !prevQuery?._hasDependents()) {
            prevQuery?.abort();
          }
        }),
      )
      .subscribe();

    destroy$.subscribe(() => {
      subject.value?._removeDependent(componentId);

      if (!subject.value?._hasDependents()) {
        // TODO: This should only happen for queries that can be cached. (e.g. GET requests).
        //       Something like a POST request should not be cancelled when a component gets destroyed.
        subject.value?.abort();
      }
    });

    // 1. get the component id in here
    // 2. if a new query gets pushed into the subject, add the component id to the query dependencies
    // 3. if the component gets destroyed, remove the component id from the query dependencies

    // 4. if a new query gets pushed into the subject, check if the previous query should be cancelled
    //    This should only happen if the query has a single dependency and the component id is the same as the one that called createSubject.
    //    Do nothing otherwise.

    // 5. if the component gets destroyed, check if the query should be cancelled (same as 4). Should be true by default.

    return subject;
  };

  createSignal = (initialValue?: ReturnType<typeof this.prepare> | null, config?: QueryContainerConfig) => {
    assertInInjectionContext(this.createSignal);

    const signal = querySignal<ReturnType<typeof this.prepare> | null>(initialValue ?? null, config);

    return signal;
  };

  /**
   * @deprecated Use `myQuery.createSubject()` or `myQuery.createSignal()` instead. Will be removed in v5.
   */
  behaviorSubject = (initialValue?: ReturnType<typeof this.prepare> | null, config?: QueryContainerConfig) =>
    new QuerySubject<ReturnType<typeof this.prepare> | null>(initialValue ?? null, config);
}
