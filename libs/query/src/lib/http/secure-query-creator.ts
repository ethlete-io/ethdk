import { AnyCreateBearerAuthProviderResult } from '../auth';
import { createBaseQueryCreator } from './base-query-creator-factory';
import { QueryArgs } from './query';
import { CreateQueryCreatorOptions, InternalCreateQueryCreatorOptions, QueryCreator } from './query-creator';
import { createSecureQuery } from './secure-query';

export type InternalSecureCreateQueryCreatorOptions<TArgs extends QueryArgs> =
  InternalCreateQueryCreatorOptions<TArgs> & {
    authProvider: AnyCreateBearerAuthProviderResult;
  };

export const createSecureQueryCreator = <TArgs extends QueryArgs>(
  options: CreateQueryCreatorOptions | undefined,
  internals: InternalSecureCreateQueryCreatorOptions<TArgs>,
): QueryCreator<TArgs> =>
  createBaseQueryCreator({
    options,
    internals,
    queryFactory: createSecureQuery,
  });
