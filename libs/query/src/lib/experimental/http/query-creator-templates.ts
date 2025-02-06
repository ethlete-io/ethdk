import { AnyBearerAuthProviderConfig } from '../auth/bearer-auth-provider-config';
import { QueryArgs } from './query';
import { QueryClientConfig } from './query-client-config';
import { CreateQueryCreatorOptions, RouteType, createQueryCreator } from './query-creator';
import { createSecureQueryCreator } from './secure-query-creator';

/** A query creator that creates a GET query */
export const createGetQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'GET', client, route });
};

/** A query creator that creates a secure GET query (requires authentication) */
export const createSecureGetQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'GET', client, authProvider, route });
};

/** A query creator that creates a POST query */
export const createPostQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'POST', client, route });
};

/** A query creator that creates a secure POST query (requires authentication) */
export const createSecurePostQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'POST', client, authProvider, route });
};

/** A query creator that creates a PUT query */
export const createPutQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'PUT', client, route });
};

/** A query creator that creates a secure PUT query (requires authentication) */
export const createSecurePutQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'PUT', client, authProvider, route });
};

/** A query creator that creates a DELETE query */
export const createDeleteQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'DELETE', client, route });
};

/** A query creator that creates a secure DELETE query (requires authentication) */
export const createSecureDeleteQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'DELETE', client, authProvider, route });
};

/** A query creator that creates a PATCH query */
export const createPatchQuery = (client: QueryClientConfig) => {
  return <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'PATCH', client, route });
};

/** A query creator that creates a secure PATCH query (requires authentication) */
export const createSecurePatchQuery = (client: QueryClientConfig, authProvider: AnyBearerAuthProviderConfig) => {
  return <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
    createSecureQueryCreator<TArgs>(creatorOptions, { method: 'PATCH', client, authProvider, route });
};
