import {
  CreateQueryCreatorOptions,
  Query,
  QueryClientConfig,
  QueryConfig,
  QueryCreator,
  QueryFeature,
  RouteType,
  splitQueryConfig,
} from '../http';
import { createGqlQuery, GqlQueryArgs } from './gql-query';

export type CreateGqlQueryCreatorOptions<TArgs extends GqlQueryArgs> = Omit<CreateQueryCreatorOptions, 'route'> & {
  route?: RouteType<TArgs>;
};

export type GqlQueryMethod = 'QUERY' | 'MUTATE';
export type GqlQueryTransport = 'GET' | 'POST';

export type InternalCreateGqlQueryCreatorOptions = {
  method: GqlQueryMethod;
  transport: GqlQueryTransport;
  client: QueryClientConfig;
  query: string;
};

export const createGqlQueryCreator = <TArgs extends GqlQueryArgs>(
  options: CreateGqlQueryCreatorOptions<TArgs> | undefined,
  internals: InternalCreateGqlQueryCreatorOptions,
): QueryCreator<TArgs> => {
  function queryCreator(...features: QueryFeature<TArgs>[]): Query<TArgs>;
  function queryCreator(queryConfig: QueryConfig, ...features: QueryFeature<TArgs>[]): Query<TArgs>;

  function queryCreator(...args: (QueryFeature<TArgs> | QueryConfig)[]): Query<TArgs> {
    const { features, queryConfig } = splitQueryConfig<TArgs>(args);

    return createGqlQuery<TArgs>({
      creator: options,
      creatorInternals: internals,
      features,
      queryConfig,
    });
  }

  return queryCreator;
};
