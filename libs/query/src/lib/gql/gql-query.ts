import { createBaseQuery, CreateQueryOptions, QueryArgs } from '../http';
import { CreateGqlQueryCreatorOptions, InternalCreateGqlQueryCreatorOptions } from './gql-query-creator';
import { createGqlExecuteFn } from './gql-query-execute';

export type GqlQueryArgs = QueryArgs & {
  variables?: Record<string, unknown>;
};

export type CreateGqlQueryOptions<TArgs extends GqlQueryArgs> = Omit<
  CreateQueryOptions<TArgs>,
  'creator' | 'creatorInternals'
> & {
  creator?: CreateGqlQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateGqlQueryCreatorOptions;
};

export type GqlVariablesType<T extends GqlQueryArgs | null> = T extends GqlQueryArgs ? T['variables'] : never;

export const isCreateGqlQueryOptions = <TArgs extends QueryArgs>(
  options: CreateQueryOptions<TArgs> | CreateGqlQueryOptions<TArgs>,
): options is CreateGqlQueryOptions<TArgs> => {
  return 'transport' in options.creatorInternals;
};

export const createGqlQuery = <TArgs extends GqlQueryArgs>(options: CreateGqlQueryOptions<TArgs>) =>
  createBaseQuery({
    creator: options.creator,
    creatorInternals: options.creatorInternals,
    features: options.features,
    queryConfig: options.queryConfig,
    executeFactory: createGqlExecuteFn,
  });
