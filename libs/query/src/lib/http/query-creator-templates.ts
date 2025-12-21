import { AnyBearerAuthProvider } from '../auth';
import { QueryArgs } from './query';
import { AnyQueryClient } from './query-client';
import { CreateQueryCreatorOptions, QueryMethod, RouteType, createQueryCreator } from './query-creator';
import { createSecureQueryCreator } from './secure-query-creator';

const createQueryTemplate = (method: QueryMethod) => {
  return (client: AnyQueryClient) =>
    <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
      createQueryCreator<TArgs>(creatorOptions, { method, client, route });
};

const createSecureQueryTemplate = (method: QueryMethod) => {
  return (client: AnyQueryClient, authProvider: AnyBearerAuthProvider) =>
    <TArgs extends QueryArgs>(route: RouteType<TArgs>, creatorOptions?: CreateQueryCreatorOptions) =>
      createSecureQueryCreator<TArgs>(creatorOptions, { method, client, authProvider, route });
};

/** A query creator that creates a GET query */
export const createGetQuery = createQueryTemplate('GET');

/** A query creator that creates a secure GET query (requires authentication) */
export const createSecureGetQuery = createSecureQueryTemplate('GET');

/** A query creator that creates a POST query */
export const createPostQuery = createQueryTemplate('POST');

/** A query creator that creates a secure POST query (requires authentication) */
export const createSecurePostQuery = createSecureQueryTemplate('POST');

/** A query creator that creates a PUT query */
export const createPutQuery = createQueryTemplate('PUT');

/** A query creator that creates a secure PUT query (requires authentication) */
export const createSecurePutQuery = createSecureQueryTemplate('PUT');

/** A query creator that creates a DELETE query */
export const createDeleteQuery = createQueryTemplate('DELETE');

/** A query creator that creates a secure DELETE query (requires authentication) */
export const createSecureDeleteQuery = createSecureQueryTemplate('DELETE');

/** A query creator that creates a PATCH query */
export const createPatchQuery = createQueryTemplate('PATCH');

/** A query creator that creates a secure PATCH query (requires authentication) */
export const createSecurePatchQuery = createSecureQueryTemplate('PATCH');
