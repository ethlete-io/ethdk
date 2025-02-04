import { AnyBearerAuthProviderConfig } from '../auth/bearer-auth-provider-config';
import { QueryArgs } from './query';
import { QueryClientConfig } from './query-client-config';
import { CreateQueryCreatorOptions, createQueryCreator } from './query-creator';
import { createSecureQueryCreator } from './secure-query-creator';

/** A query creator that creates a GET query */
export const createGetQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'GET', client });
};

/** A query creator that creates a secure GET query (requires authentication) */
export const createSecureGetQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'GET', client, authProvider });
};

/** A query creator that creates a POST query */
export const createPostQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'POST', client });
};

/** A query creator that creates a secure POST query (requires authentication) */
export const createSecurePostQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'POST', client, authProvider });
};

/** A query creator that creates a PUT query */
export const createPutQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'PUT', client });
};

/** A query creator that creates a secure PUT query (requires authentication) */
export const createSecurePutQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'PUT', client, authProvider });
};

/** A query creator that creates a DELETE query */
export const createDeleteQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'DELETE', client });
};

/** A query creator that creates a secure DELETE query (requires authentication) */
export const createSecureDeleteQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'DELETE', client, authProvider });
};

/** A query creator that creates a PATCH query */
export const createPatchQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'PATCH', client });
};

/** A query creator that creates a secure PATCH query (requires authentication) */
export const createSecurePatchQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'PATCH', client, authProvider });
};
