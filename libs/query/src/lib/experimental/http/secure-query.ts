import { CreateQueryOptions, QueryArgs } from './query';
import { setupQueryDependencies } from './query-dependencies';
import { QueryFeatureContext } from './query-features';
import { setupQueryState } from './query-state';
import { applyQueryFeatures, createQueryObject, getQueryFeatureUsage, maybeExecute } from './query-utils';
import { InternalSecureCreateQueryCreatorOptions } from './secure-query-creator';
import { createSecureExecuteFn } from './secure-query-execute';

export type CreateSecureQueryOptions<TArgs extends QueryArgs> = Omit<CreateQueryOptions<TArgs>, 'creatorInternals'> & {
  creatorInternals: InternalSecureCreateQueryCreatorOptions;
};

export const createSecureQuery = <TArgs extends QueryArgs>(options: CreateSecureQueryOptions<TArgs>) => {
  const deps = setupQueryDependencies({ clientConfig: options.creatorInternals.client });
  const state = setupQueryState<TArgs>({});
  const { creator, creatorInternals, queryConfig } = options;
  const flags = getQueryFeatureUsage(options);

  const execute = createSecureExecuteFn<TArgs>({
    deps,
    state,
    creator,
    creatorInternals,
    queryConfig,
  });

  const featureFnContext: QueryFeatureContext<TArgs> = {
    deps,
    state,
    execute,
    flags,
  };

  applyQueryFeatures(options.features, featureFnContext);

  maybeExecute({ execute, flags });

  return createQueryObject({ state, execute, deps });
};
