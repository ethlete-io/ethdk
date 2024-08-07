import { AnyBearerAuthProviderConfig } from './bearer-auth-provider-config';
import { QueryArgs } from './query';
import { QueryClientConfig } from './query-client-config';
import { CreateQueryCreatorOptions, createQueryCreator } from './query-creator';
import { createSecureQueryCreator } from './secure-query-creator';

export const createGetQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'GET', client });
};

export const createSecureGetQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'GET', client, authProvider });
};

export const createPostQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'POST', client });
};

export const createSecurePostQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'POST', client, authProvider });
};

export const createPutQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'PUT', client });
};

export const createSecurePutQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'PUT', client, authProvider });
};

export const createDeleteQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'DELETE', client });
};

export const createSecureDeleteQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'DELETE', client, authProvider });
};

export const createPatchQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'PATCH', client });
};

export const createSecurePatchQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'PATCH', client, authProvider });
};
