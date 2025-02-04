import {
  applyQueryFeatures,
  createQueryObject,
  CreateQueryOptions,
  getQueryFeatureUsage,
  maybeExecute,
  QueryArgs,
  QueryFeatureContext,
  setupQueryDependencies,
  setupQueryState,
} from '../http';
import { CreateGqlQueryCreatorOptions, InternalCreateGqlQueryCreatorOptions } from './gql-query-creator';
import { createGqlExecuteFn } from './gql-query-execute';

export type GqlQueryArgs = QueryArgs & {
  variables?: Record<string, unknown>;
};

export type CreateGqlQueryOptions<TArgs extends GqlQueryArgs> = Omit<
  CreateQueryOptions<TArgs>,
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

export const createGqlQuery = <TArgs extends GqlQueryArgs>(options: CreateGqlQueryOptions<TArgs>) => {
  const deps = setupQueryDependencies({ clientConfig: options.creatorInternals.client });
  const state = setupQueryState<TArgs>({});
  const { creator, creatorInternals, queryConfig } = options;
  const flags = getQueryFeatureUsage(options);

  const execute = createGqlExecuteFn<TArgs>({
    deps,
    state,
    creator,
    creatorInternals,
    queryConfig,
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
};
