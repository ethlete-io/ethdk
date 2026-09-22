import {
  AnyCreateQueryClientResult,
  createBaseQueryCreator,
  CreateQueryCreatorOptions,
  QueryCreator,
  RawResponseType,
  ResponseType,
  RouteType,
} from '../http';
import { createGqlQuery, GqlQueryArgs } from './gql-query';
import { unwrapGqlResponse } from './gql-response';

/**
 * The envelope a GraphQL endpoint puts on the wire: whatever the args declare as `rawResponse`, or
 * `{ data: TResponse }` - the GraphQL-over-HTTP envelope the default unwrapping reads - when they
 * declare none.
 */
export type GqlRawResponseType<TArgs extends GqlQueryArgs> = 'rawResponse' extends keyof TArgs
  ? RawResponseType<TArgs>
  : { data: ResponseType<TArgs> };

export type CreateGqlQueryCreatorOptions<TArgs extends GqlQueryArgs> = Omit<
  CreateQueryCreatorOptions<TArgs>,
  'route' | 'transformResponse'
> & {
  route?: RouteType<TArgs>;

  /**
   * Transforms the raw GraphQL response into the final response type. Optional: without one, the
   * `{ data: ... }` envelope is unwrapped - which is all the default does, so args declaring an
   * envelope the default cannot read need one.
   */
  transformResponse?: (rawResponse: GqlRawResponseType<TArgs>) => ResponseType<TArgs>;
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
      transformResponse: options?.transformResponse ?? unwrapGqlResponse,
    } as CreateGqlQueryCreatorOptions<TArgs>,
    internals,
    queryFactory: createGqlQuery,
  });
