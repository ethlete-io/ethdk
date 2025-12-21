import { AnyBearerAuthProvider } from '../auth';
import { AnyQueryClient, createBaseQueryCreator, QueryCreator } from '../http';
import { GqlQueryArgs } from './gql-query';
import { CreateGqlQueryCreatorOptions } from './gql-query-creator';
import { createSecureGqlQuery } from './secure-gql-query';

export type InternalSecureCreateGqlQueryCreatorOptions = {
  method: 'QUERY' | 'MUTATE';
  transport: 'GET' | 'POST';
  client: AnyQueryClient;
  query: string;
  authProvider: AnyBearerAuthProvider;
};

export const createSecureGqlQueryCreator = <TArgs extends GqlQueryArgs>(
  options: CreateGqlQueryCreatorOptions<TArgs> | undefined,
  internals: InternalSecureCreateGqlQueryCreatorOptions,
): QueryCreator<TArgs> =>
  createBaseQueryCreator({
    options: {
      ...options,
      // Use custom transformResponse if provided, otherwise use default GQL unwrapping
      transformResponse:
        options?.transformResponse ??
        ((rawResponse: unknown) => {
          if (rawResponse && typeof rawResponse === 'object' && 'data' in rawResponse) {
            return (rawResponse as { data: unknown }).data;
          }
          return rawResponse;
        }),
    },
    internals,
    queryFactory: createSecureGqlQuery,
  });
