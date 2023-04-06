import { BehaviorSubject } from 'rxjs';
import { Query, computeQueryQueryParams, isGqlQueryConfig } from '../query';
import { QueryClient, buildGqlCacheKey, shouldCacheQuery } from '../query-client';
import { QueryStore } from '../query-store';
import { BaseArguments, GqlQueryConfig, RestQueryConfig, RouteType, WithHeaders } from '../query/query.types';
import { Method as MethodType, buildRoute } from '../request';
import { QueryPrepareFn } from './query-creator.types';

export class QueryCreator<
  Arguments extends BaseArguments | undefined,
  Method extends MethodType,
  Response,
  Route extends RouteType<Arguments>,
  Entity,
> {
  constructor(
    private _queryConfig:
      | RestQueryConfig<Route, Response, Arguments, Entity>
      | GqlQueryConfig<Route, Response, Arguments, Entity>,
    private _client: QueryClient,
    private _store: QueryStore,
  ) {}

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  prepare: QueryPrepareFn<Arguments, Response, Route, Method, Entity> = (args?: Arguments & WithHeaders) => {
    const route = buildRoute({
      base: this._client.config.baseRoute,
      route: this._queryConfig.route,
      pathParams: args?.pathParams,
      queryParams: computeQueryQueryParams({ config: this._queryConfig, client: this._client, args }),
    }) as Route;

    const cacheKey = isGqlQueryConfig(this._queryConfig) ? buildGqlCacheKey(this._queryConfig, args) : route;

    if (shouldCacheQuery(this._queryConfig.method)) {
      const existingQuery = this._store.get<Query<Response, Arguments, Route, Method, Entity>>(cacheKey);

      if (existingQuery) {
        return existingQuery;
      }
    }

    const query = new Query<Response, Arguments, Route, Method, Entity>(
      this._client,
      this._queryConfig,
      route,
      args ?? ({} as Arguments),
    );

    if (shouldCacheQuery(this._queryConfig.method)) {
      this._store.add(cacheKey, query);
    }

    return query;
  };

  behaviorSubject = (initialValue?: ReturnType<typeof this.prepare> | null) =>
    new BehaviorSubject<ReturnType<typeof this.prepare> | null>(initialValue ?? null);
}
