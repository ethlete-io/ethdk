import { Injector, assertInInjectionContext, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { createDestroy } from '@ethlete/core';
import { BehaviorSubject, Observable, pairwise, startWith, takeUntil, tap } from 'rxjs';
import { EntityStore } from '../entity';
import { Query, computeQueryQueryParams, isGqlQueryConfig } from '../query';
import { QueryClient, buildGqlCacheKey, shouldCacheQuery } from '../query-client';
import { QueryStore } from '../query-store';
import { AnyQuery, BaseArguments, GqlQueryConfig, RestQueryConfig, RouteType, WithHeaders } from '../query/query.types';
import { buildRoute } from '../request';
import { QueryContainerConfig } from '../utils';
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

    const subject = new BehaviorSubject<ReturnType<typeof this.prepare> | null>(initialValue ?? null);

    this._addQueryContainerHandling(subject, () => subject.getValue(), config);

    return subject;
  };

  createSignal = (initialValue?: ReturnType<typeof this.prepare> | null, config?: QueryContainerConfig) => {
    assertInInjectionContext(this.createSignal);

    const _signal = signal<ReturnType<typeof this.prepare> | null>(initialValue ?? null);

    this._addQueryContainerHandling(toObservable(_signal), () => _signal(), config);

    return _signal;
  };

  /**
   * @deprecated Use `myQuery.createSubject()` or `myQuery.createSignal()` instead. Will be removed in v5.
   */
  behaviorSubject = (initialValue?: ReturnType<typeof this.prepare> | null) =>
    new BehaviorSubject<ReturnType<typeof this.prepare> | null>(initialValue ?? null);

  private _addQueryContainerHandling = (
    obs: Observable<AnyQuery | null>,
    valueFn: () => AnyQuery | null,
    config?: QueryContainerConfig,
  ) => {
    const { abortPrevious, abortOnDestroy } = config ?? {};

    const injector = inject(Injector);
    const destroy$ = createDestroy();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tNode = (injector as any)._tNode;
    const componentId = tNode?.index ?? -1;

    obs
      .pipe(
        takeUntil(destroy$),
        pairwise(),
        startWith([null, valueFn()]),
        tap(([prevQuery, currQuery]) => {
          prevQuery?._removeDependent(componentId);
          currQuery?._addDependent(componentId);

          if (
            !prevQuery?._hasDependents() &&
            ((abortPrevious === undefined && prevQuery?.canBeCached) || abortPrevious)
          ) {
            prevQuery?.abort();
          }
        }),
      )
      .subscribe();

    destroy$.subscribe(() => {
      const query = valueFn();

      query?._removeDependent(componentId);

      if (!query?._hasDependents() && ((query?.canBeCached && abortOnDestroy === undefined) || abortOnDestroy)) {
        query?.abort();
      }
    });
  };
}
