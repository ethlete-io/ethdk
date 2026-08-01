/* eslint-disable @typescript-eslint/no-explicit-any */
import { CreateGqlQueryOptions } from '../../gql/gql-query';
import { CreateQueryOptions, QueryArgs } from '../query';

/**
 * Whether a create-query options object came from the gql layer — only gql's `creatorInternals` carries
 * a `transport`. Lives here because `base-query-factory` is what branches on it; `gql/gql-query`
 * re-exports it under its original public name.
 */
export const isCreateGqlQueryOptions = <TArgs extends QueryArgs>(
  options: CreateQueryOptions<TArgs> | CreateGqlQueryOptions<any>,
): options is CreateGqlQueryOptions<any> => 'transport' in options.creatorInternals;
