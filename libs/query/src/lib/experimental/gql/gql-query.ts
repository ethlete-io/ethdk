import { CreateQueryOptions, QueryArgs } from '../query';
import { setupQueryDependencies } from '../query-dependencies';
import { QueryFeatureContext } from '../query-features';
import { createQuerySnapshotFn } from '../query-snapshot';
import { setupQueryState } from '../query-state';
import { applyQueryFeatures, createQueryObject, getQueryFeatureUsage, maybeExecute } from '../query-utils';
import { CreateGqlQueryCreatorOptions, InternalCreateGqlQueryCreatorOptions } from './gql-query-creator';
import { createGqlExecuteFn } from './gql-query-execute';

export type GqlQueryArgs = QueryArgs & {
  variables?: Record<string, unknown>;
};

export type CreateGqlQueryOptions<TArgs extends GqlQueryArgs> = Omit<
  CreateQueryOptions<GqlQueryArgs>,
  'creator' | 'creatorInternals'
> & {
  creator: CreateGqlQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateGqlQueryCreatorOptions;
};

export type GqlVariablesType<T extends GqlQueryArgs | null> = T extends GqlQueryArgs ? T['variables'] : never;

export const isCreateGqlQueryOptions = <TArgs extends QueryArgs>(
  options: CreateQueryOptions<TArgs> | CreateGqlQueryOptions<TArgs>,
): options is CreateGqlQueryOptions<TArgs> => {
  return 'transport' in options.creatorInternals;
};

export const createQuery = <TArgs extends GqlQueryArgs>(options: CreateGqlQueryOptions<TArgs>) => {
  const deps = setupQueryDependencies({ clientConfig: options.creatorInternals.client });
  const state = setupQueryState<TArgs>({});
  const { creator, creatorInternals, queryConfig } = options;
  const flags = getQueryFeatureUsage(options);

  const execute = createGqlExecuteFn<TArgs>({
    deps,
    state,
    creator,
    creatorInternals,
    queryConfig: options.queryConfig,
  });
  const createSnapshot = createQuerySnapshotFn({ state, deps, execute });
  const destroy = () => deps.injector.destroy();

  // TODO: Fix this

  const featureFnContext: QueryFeatureContext<TArgs> = {
    state,
    queryConfig,
    creatorConfig: creator as any,
    creatorInternals: creatorInternals as any,
    execute,
    flags,
    deps,
  };

  applyQueryFeatures(options as any, featureFnContext);

  maybeExecute({ execute, flags });

  return createQueryObject({ state, execute, createSnapshot, destroy });
};
