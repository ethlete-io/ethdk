/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { BearerAuthProviderConfig, BearerAuthProviderRef } from './bearer-auth-provider-config';
import { QueryArgs } from './query';
import { QueryClientConfig } from './query-client-config';
import { CreateQueryCreatorOptions, createQueryCreator } from './query-creator';

export type CreateClientQueryOptions = {};

export type CreateSecureQueryOptions = CreateClientQueryOptions & {
  authProviderRef: BearerAuthProviderRef;
};

export const createGetQuery = (client: QueryClientConfig, options?: CreateClientQueryOptions) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'GET', client });
};

export const createSecureGetQuery = (client: QueryClientConfig, authProvider: BearerAuthProviderConfig) => {};

export const createPostQuery = (client: QueryClientConfig, options?: CreateClientQueryOptions) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'POST', client });
};

export const createSecurePostQuery = (client: QueryClientConfig, authProvider: BearerAuthProviderConfig) => {};
