/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { BearerAuthProviderConfig, BearerAuthProviderRef } from './bearer-auth-provider-config';
import { QueryArgs } from './query';
import { QueryClientConfig } from './query-client-config';
import { CreateQueryCreatorOptions, createQueryCreator } from './query-creator';

export type CreateClientQueryOptions = {};

export type CreateSecureQueryOptions<
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
> = CreateClientQueryOptions & {
  authProviderRef: BearerAuthProviderRef<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs>;
};

export const createGetQuery = (client: QueryClientConfig, options?: CreateClientQueryOptions) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'GET', client });
};

export const createSecureGetQuery = <
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
>(
  client: QueryClientConfig,
  authProvider: BearerAuthProviderConfig<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs>,
) => {};

export const createPostQuery = (client: QueryClientConfig, options?: CreateClientQueryOptions) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'POST', client });
};

export const createSecurePostQuery = <
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
>(
  client: QueryClientConfig,
  authProvider: BearerAuthProviderConfig<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs>,
) => {};
