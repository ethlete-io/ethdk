import { createBaseQuery } from './base-query-factory';
import { CreateQueryOptions, QueryArgs } from './query';
import { InternalSecureCreateQueryCreatorOptions } from './secure-query-creator';
import { createSecureExecuteFn } from './secure-query-execute';

export type CreateSecureQueryOptions<TArgs extends QueryArgs> = Omit<CreateQueryOptions<TArgs>, 'creatorInternals'> & {
  creatorInternals: InternalSecureCreateQueryCreatorOptions<TArgs>;
};

export const createSecureQuery = <TArgs extends QueryArgs>(options: CreateSecureQueryOptions<TArgs>) =>
  createBaseQuery({
    creator: options.creator,
    creatorInternals: options.creatorInternals,
    features: options.features,
    queryConfig: options.queryConfig,
    executeFactory: createSecureExecuteFn,
  });
