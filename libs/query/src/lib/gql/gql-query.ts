import { createBaseQuery, CreateQueryOptions, QueryArgs } from '../http';
import { CreateGqlQueryCreatorOptions, InternalCreateGqlQueryCreatorOptions } from './gql-query-creator';
import { createGqlExecuteFn } from './gql-query-execute';

export type GqlQueryArgs<TResponse = unknown> = QueryArgs & {
  response: TResponse;
  rawResponse?: unknown;
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

export { isCreateGqlQueryOptions } from '../http/internal/gql-options-guard';

export const createGqlQuery = <TArgs extends GqlQueryArgs>(options: CreateGqlQueryOptions<TArgs>) =>
  createBaseQuery({
    creator: options.creator,
    creatorInternals: options.creatorInternals,
    features: options.features,
    queryConfig: options.queryConfig,
    executeFactory: createGqlExecuteFn,
  });
