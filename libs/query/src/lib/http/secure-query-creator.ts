import { AnyBearerAuthProviderConfig } from '../auth/bearer-auth-provider-config';
import { Query, QueryArgs } from './query';
import {
  CreateQueryCreatorOptions,
  InternalCreateQueryCreatorOptions,
  QueryConfig,
  QueryCreator,
  splitQueryConfig,
} from './query-creator';
import { QueryFeature } from './query-features';
import { createSecureQuery } from './secure-query';

export type InternalSecureCreateQueryCreatorOptions<TArgs extends QueryArgs> =
  InternalCreateQueryCreatorOptions<TArgs> & {
    authProvider: AnyBearerAuthProviderConfig;
  };

export const createSecureQueryCreator = <TArgs extends QueryArgs>(
  options: CreateQueryCreatorOptions | undefined,
  internals: InternalSecureCreateQueryCreatorOptions<TArgs>,
): QueryCreator<TArgs> => {
  function queryCreator(...features: QueryFeature<TArgs>[]): Query<TArgs>;
  function queryCreator(queryConfig: QueryConfig, ...features: QueryFeature<TArgs>[]): Query<TArgs>;

  function queryCreator(...args: (QueryFeature<TArgs> | QueryConfig)[]): Query<TArgs> {
    const { features, queryConfig } = splitQueryConfig<TArgs>(args);

    return createSecureQuery<TArgs>({
      creator: options,
      creatorInternals: internals,
      features,
      queryConfig,
    });
  }

  return queryCreator;
};
