import { createBaseQuery, CreateQueryOptions } from '../http';
import { GqlQueryArgs } from './gql-query';
import { InternalSecureCreateGqlQueryCreatorOptions } from './secure-gql-query-creator';
import { createSecureGqlExecuteFn } from './secure-gql-query-execute';

export type CreateSecureGqlQueryOptions<TArgs extends GqlQueryArgs> = Omit<
  CreateQueryOptions<TArgs>,
  'creatorInternals'
> & {
  creatorInternals: InternalSecureCreateGqlQueryCreatorOptions;
};

export const createSecureGqlQuery = <TArgs extends GqlQueryArgs>(options: CreateSecureGqlQueryOptions<TArgs>) =>
  createBaseQuery({
    creator: options.creator,
    creatorInternals: options.creatorInternals,
    features: options.features,
    queryConfig: options.queryConfig,
    executeFactory: createSecureGqlExecuteFn,
  });
