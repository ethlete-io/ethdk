import { Query, QueryArgs } from './query';
import { QueryConfig, QueryCreator, splitQueryConfig } from './query-creator';
import { QueryFeature } from './query-features';

export type BaseQueryCreatorFactoryOptions<TArgs extends QueryArgs, TOptions, TInternals> = {
  /** Creator-specific options (e.g., CreateQueryCreatorOptions or CreateGqlQueryCreatorOptions) */
  options: TOptions | undefined;

  /** Creator-specific internals (e.g., InternalCreateQueryCreatorOptions or InternalCreateGqlQueryCreatorOptions) */
  internals: TInternals;

  /** Factory function that creates the actual query */
  queryFactory: (config: {
    creator: TOptions | undefined;
    creatorInternals: TInternals;
    features: QueryFeature<TArgs>[];
    queryConfig: QueryConfig;
  }) => Query<TArgs>;
};

export const createBaseQueryCreator = <TArgs extends QueryArgs, TOptions, TInternals>(
  config: BaseQueryCreatorFactoryOptions<TArgs, TOptions, TInternals>,
): QueryCreator<TArgs> => {
  function queryCreator(...features: QueryFeature<TArgs>[]): Query<TArgs>;
  function queryCreator(queryConfig: QueryConfig, ...features: QueryFeature<TArgs>[]): Query<TArgs>;

  function queryCreator(...args: (QueryFeature<TArgs> | QueryConfig)[]): Query<TArgs> {
    const { features, queryConfig } = splitQueryConfig<TArgs>(args);

    return config.queryFactory({
      creator: config.options,
      creatorInternals: config.internals,
      features,
      queryConfig,
    });
  }

  return queryCreator;
};
