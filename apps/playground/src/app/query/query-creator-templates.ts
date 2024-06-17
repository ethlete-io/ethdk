/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { BearerAuthProvider } from './bearer-auth-provider';
import { QueryArgs } from './query';
import { QueryClientConfig } from './query-client-config';
import { CreateQueryCreatorOptions, createQueryCreator } from './query-creator';

export type CreateClientQueryOptions = {};

export type CreateSecureQueryOptions = CreateClientQueryOptions & {
  authProvider: BearerAuthProvider;
};

export const createGetQuery = (client: QueryClientConfig, options?: CreateClientQueryOptions) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'GET', client });
};

export const createSecureGetQuery = (options: CreateSecureQueryOptions) => {};
