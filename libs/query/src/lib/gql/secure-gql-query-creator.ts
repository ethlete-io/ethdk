import { AnyCreateBearerAuthProviderResult } from '../auth';
import { AnyCreateQueryClientResult, createBaseQueryCreator, QueryCreator } from '../http';
import { GqlQueryArgs } from './gql-query';
import { CreateGqlQueryCreatorOptions } from './gql-query-creator';
import { unwrapGqlResponse } from './gql-response';
import { createSecureGqlQuery } from './secure-gql-query';

export type InternalSecureCreateGqlQueryCreatorOptions = {
  method: 'QUERY' | 'MUTATE';
  transport: 'GET' | 'POST';
  client: AnyCreateQueryClientResult;
  query: string;
  authProvider: AnyCreateBearerAuthProviderResult;
};

export const createSecureGqlQueryCreator = <TArgs extends GqlQueryArgs>(
  options: CreateGqlQueryCreatorOptions<TArgs> | undefined,
  internals: InternalSecureCreateGqlQueryCreatorOptions,
): QueryCreator<TArgs> =>
  createBaseQueryCreator({
    options: {
      ...options,
      transformResponse: options?.transformResponse ?? unwrapGqlResponse,
    },
    internals,
    queryFactory: createSecureGqlQuery,
  });
