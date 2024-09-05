import { CreateQueryOptions, Query, QueryArgs } from './query';
import { setupQueryDependencies } from './query-dependencies';
import { QueryFeatureContext } from './query-features';
import { createQuerySnapshotFn } from './query-snapshot';
import { setupQueryState } from './query-state';
import { applyQueryFeatures, getQueryFeatureUsage, maybeExecute } from './query-utils';
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
    queryConfig: options.queryConfig,
  });
  const createSnapshot = createQuerySnapshotFn({ state, deps, execute });
  const destroy = () => deps.injector.destroy();

  const featureFnContext: QueryFeatureContext<TArgs> = {
    state,
    queryConfig,
    creatorConfig: creator,
    creatorInternals,
    execute,
    flags,
    deps,
  };

  applyQueryFeatures(options, featureFnContext);

  maybeExecute<TArgs>({ execute, flags });

  const query: Query<TArgs> = {
    execute,
    args: state.args.asReadonly(),
    response: state.response.asReadonly(),
    latestHttpEvent: state.latestHttpEvent.asReadonly(),
    loading: state.loading.asReadonly(),
    error: state.error.asReadonly(),
    lastTimeExecutedAt: state.lastTimeExecutedAt.asReadonly(),
    id: execute.currentRepositoryKey,
    createSnapshot,
    destroy,
  };

  return query;
};
