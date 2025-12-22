import {
  AnyCreateQueryClientResult,
  createBaseQueryCreator,
  CreateQueryCreatorOptions,
  QueryCreator,
  RouteType,
} from '../http';
import { createGqlQuery, GqlQueryArgs } from './gql-query';

export type CreateGqlQueryCreatorOptions<TArgs extends GqlQueryArgs> = Omit<
  CreateQueryCreatorOptions<TArgs>,
  'route' | 'transformResponse'
> & {
  route?: RouteType<TArgs>;

  /**
   * Optional custom transform function for GQL responses.
   * If not provided, the default { data: ... } unwrapping will be used.
   */
  transformResponse?: CreateQueryCreatorOptions<TArgs>['transformResponse'];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCreateGqlQueryCreatorOptions = CreateGqlQueryCreatorOptions<any>;

export type GqlQueryMethod = 'QUERY' | 'MUTATE';
export type GqlQueryTransport = 'GET' | 'POST';

export type InternalCreateGqlQueryCreatorOptions = {
  method: GqlQueryMethod;
  transport: GqlQueryTransport;
  client: AnyCreateQueryClientResult;
  query: string;
};

export const createGqlQueryCreator = <TArgs extends GqlQueryArgs>(
  options: CreateGqlQueryCreatorOptions<TArgs> | undefined,
  internals: InternalCreateGqlQueryCreatorOptions,
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
    } as CreateQueryCreatorOptions<TArgs>,
    internals,
    queryFactory: createGqlQuery,
  });
