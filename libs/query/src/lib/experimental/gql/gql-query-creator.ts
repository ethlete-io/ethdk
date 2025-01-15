import { Query } from '../query';
import { QueryClientConfig } from '../query-client-config';
import { CreateQueryCreatorOptions, QueryConfig, QueryCreator, RouteType, splitQueryConfig } from '../query-creator';
import { QueryFeature } from '../query-features';
import { createGqlQuery, GqlQueryArgs } from './gql-query';

export type CreateGqlQueryCreatorOptions<TArgs extends GqlQueryArgs> = Omit<
  CreateQueryCreatorOptions<TArgs>,
  'route'
> & {
  query: string;
  route?: RouteType<TArgs>;
};

export type GqlQueryMethod = 'QUERY' | 'MUTATE';
export type GqlQueryTransport = 'GET' | 'POST';

export type InternalCreateGqlQueryCreatorOptions = {
  method: GqlQueryMethod;
  transport: GqlQueryTransport;
  client: QueryClientConfig;
};

export const createGqlQueryCreator = <TArgs extends GqlQueryArgs>(
  options: CreateGqlQueryCreatorOptions<TArgs>,
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
