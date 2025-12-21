import { AnyQueryClient, createBaseQueryCreator, CreateQueryCreatorOptions, QueryCreator, RouteType } from '../http';
import { createGqlQuery, GqlQueryArgs } from './gql-query';

export type CreateGqlQueryCreatorOptions<TArgs extends GqlQueryArgs> = Omit<CreateQueryCreatorOptions, 'route'> & {
  route?: RouteType<TArgs>;
};

export type GqlQueryMethod = 'QUERY' | 'MUTATE';
export type GqlQueryTransport = 'GET' | 'POST';

export type InternalCreateGqlQueryCreatorOptions = {
  method: GqlQueryMethod;
  transport: GqlQueryTransport;
  client: AnyQueryClient;
  query: string;
};

export const createGqlQueryCreator = <TArgs extends GqlQueryArgs>(
  options: CreateGqlQueryCreatorOptions<TArgs> | undefined,
  internals: InternalCreateGqlQueryCreatorOptions,
): QueryCreator<TArgs> =>
  createBaseQueryCreator({
    options,
    internals,
    queryFactory: createGqlQuery,
  });
