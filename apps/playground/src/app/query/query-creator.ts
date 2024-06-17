/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { PathParamsType, Query, QueryArgs, createQuery } from './query';
import { QueryClientConfig } from './query-client-config';
import { QueryFeature } from './query-features';

export type RouteType<TArgs extends QueryArgs> =
  PathParamsType<TArgs> extends { [key: string]: string } ? (args: TArgs['pathParams']) => RouteString : RouteString;

export type RouteString = `/${string}`;

export type CreateQueryCreatorOptions<TArgs extends QueryArgs> = {
  route: RouteType<TArgs>;
  reportProgress?: boolean;
  responseType?: 'json';
  withCredentials?: boolean;
  transferCache?:
    | {
        includeHeaders?: string[];
      }
    | boolean;
};

export type QueryMethod = 'GET' | 'OPTIONS' | 'HEAD';

export type InternalCreateQueryCreatorOptions = {
  method: QueryMethod;
  client: QueryClientConfig;
};

export type QueryConfig = {
  /** A custom id to use for this query. Only affects queries that can be cached. */
  key?: string;

  /**
   * If true, the query will not be executed automatically.
   * Does not affect mutations such as POST, PUT etc. since those are never executed automatically.
   */
  onlyManualExecution?: boolean;
};

export const splitQueryConfig = <TArgs extends QueryArgs>(args: (QueryFeature<TArgs> | QueryConfig)[]) => {
  let queryConfig: QueryConfig = {};
  let features: QueryFeature<TArgs>[] = [];

  const first = args[0];

  if (first) {
    if ('type' in first) {
      features = args as QueryFeature<TArgs>[];
    } else {
      [queryConfig, ...features] = args as [QueryConfig, ...QueryFeature<TArgs>[]];
    }
  }
  return { features, queryConfig };
};

export const createQueryCreator = <TArgs extends QueryArgs>(
  options: CreateQueryCreatorOptions<TArgs>,
  internals: InternalCreateQueryCreatorOptions,
) => {
  function queryCreator(...features: QueryFeature<TArgs>[]): Query<TArgs>;
  function queryCreator(queryConfig: QueryConfig, ...features: QueryFeature<TArgs>[]): Query<TArgs>;

  function queryCreator(...args: (QueryFeature<TArgs> | QueryConfig)[]): Query<TArgs> {
    const { features, queryConfig } = splitQueryConfig<TArgs>(args);

    return createQuery<TArgs>({
      creator: options,
      creatorInternals: internals,
      features,
      queryConfig,
    });
  }

  return queryCreator;
};
