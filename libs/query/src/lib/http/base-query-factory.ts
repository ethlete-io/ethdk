import { runInInjectionContext } from '@angular/core';
import { QueryArgs } from './query';
import { AnyCreateQueryClientResult } from './query-client';
import { CreateQueryCreatorOptions, QueryConfig } from './query-creator';
import { QueryDependencies, setupQueryDependencies } from './query-dependencies';
import { InternalQueryExecute } from './query-execute';
import { QueryFeature, QueryFeatureContext } from './query-features';
import { QueryState, setupQueryState } from './query-state';
import { applyQueryFeatures, createQueryObject, getQueryFeatureUsage, maybeExecute } from './query-utils';

export type ExecuteFactory<TArgs extends QueryArgs, TInternals> = (options: {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator?: CreateQueryCreatorOptions;
  creatorInternals: TInternals;
  queryConfig: QueryConfig;
}) => InternalQueryExecute<TArgs>;

export type CreateBaseQueryOptions<TArgs extends QueryArgs, TInternals> = {
  creator?: CreateQueryCreatorOptions;
  creatorInternals: TInternals;
  features: QueryFeature<TArgs>[];
  queryConfig: QueryConfig;
  executeFactory: ExecuteFactory<TArgs, TInternals>;
};

export const createBaseQuery = <TArgs extends QueryArgs, TInternals extends { client: AnyCreateQueryClientResult }>(
  options: CreateBaseQueryOptions<TArgs, TInternals>,
) => {
  const client = options.creatorInternals.client;

  const deps = setupQueryDependencies({
    client,
    queryConfig: options.queryConfig,
  });

  return runInInjectionContext(deps.injector, () => {
    const state = setupQueryState<TArgs>({
      transformResponse: options.creator?.transformResponse,
    });
    const flags = getQueryFeatureUsage(options as unknown as Parameters<typeof getQueryFeatureUsage>[0]);

    const execute = options.executeFactory({
      deps,
      state,
      creator: options.creator,
      creatorInternals: options.creatorInternals,
      queryConfig: options.queryConfig,
    });

    const featureFnContext: QueryFeatureContext<TArgs> = {
      state,
      execute,
      flags,
      deps,
    };

    applyQueryFeatures(options.features, featureFnContext);

    maybeExecute({ execute, flags });

    return createQueryObject({ state, execute, deps });
  });
};
