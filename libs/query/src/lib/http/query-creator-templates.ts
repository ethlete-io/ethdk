import { AnyCreateBearerAuthProviderResult } from '../auth';
import { QueryArgs } from './query';
import { AnyCreateQueryClientResult } from './query-client';
import {
  CreateQueryCreatorOptions,
  QueryCreator,
  QueryMethod,
  RequiresTransform,
  RouteType,
  createQueryCreator,
} from './query-creator';
import { createSecureQueryCreator } from './secure-query-creator';

// Conditional parameter type: when RequiresTransform is true, options must be provided; otherwise optional
type ConditionalOptions<TArgs extends QueryArgs> =
  RequiresTransform<TArgs> extends true
    ? [options: CreateQueryCreatorOptions<TArgs>]
    : [options?: CreateQueryCreatorOptions<TArgs>];

const createQueryTemplate = (method: QueryMethod) => {
  return (client: AnyCreateQueryClientResult) =>
    <TArgs extends QueryArgs>(route: RouteType<TArgs>, ...args: ConditionalOptions<TArgs>): QueryCreator<TArgs> =>
      createQueryCreator<TArgs>(args[0], { method, client, route });
};

const createSecureQueryTemplate = (method: QueryMethod) => {
  return (client: AnyCreateQueryClientResult, authProvider: AnyCreateBearerAuthProviderResult) =>
    <TArgs extends QueryArgs>(route: RouteType<TArgs>, ...args: ConditionalOptions<TArgs>): QueryCreator<TArgs> =>
      createSecureQueryCreator<TArgs>(args[0], { method, client, authProvider, route });
};

/** A query creator that creates a GET query */
export const createGetQuery = /* @__PURE__ */ createQueryTemplate('GET');

/** A query creator that creates a secure GET query (requires authentication) */
export const createSecureGetQuery = /* @__PURE__ */ createSecureQueryTemplate('GET');

/** A query creator that creates a POST query */
export const createPostQuery = /* @__PURE__ */ createQueryTemplate('POST');

/** A query creator that creates a secure POST query (requires authentication) */
export const createSecurePostQuery = /* @__PURE__ */ createSecureQueryTemplate('POST');

/** A query creator that creates a PUT query */
export const createPutQuery = /* @__PURE__ */ createQueryTemplate('PUT');

/** A query creator that creates a secure PUT query (requires authentication) */
export const createSecurePutQuery = /* @__PURE__ */ createSecureQueryTemplate('PUT');

/** A query creator that creates a DELETE query */
export const createDeleteQuery = /* @__PURE__ */ createQueryTemplate('DELETE');

/** A query creator that creates a secure DELETE query (requires authentication) */
export const createSecureDeleteQuery = /* @__PURE__ */ createSecureQueryTemplate('DELETE');

/** A query creator that creates a PATCH query */
export const createPatchQuery = /* @__PURE__ */ createQueryTemplate('PATCH');

/** A query creator that creates a secure PATCH query (requires authentication) */
export const createSecurePatchQuery = /* @__PURE__ */ createSecureQueryTemplate('PATCH');
