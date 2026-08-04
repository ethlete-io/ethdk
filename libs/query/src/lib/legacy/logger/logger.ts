import { QueryError } from '../../http/internal/request-route';

export {
  buildErrorMessage,
  invalidBaseRouteError,
  invalidRouteError,
  pathParamsMissingInRouteFunctionError,
  QueryError,
} from '../../http/internal/request-route';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const queryStateAlreadyHasKeyError = (data: unknown) =>
  new QueryError('004', 'The query state already contains the provided key', data);

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const queryStateDoesNotContainKeyError = (data: unknown) =>
  new QueryError('005', 'The query state does not contain the provided key', data);

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const queryStateCannotTransformError = (data: unknown) =>
  new QueryError('006', 'The query state cannot be transformed because it is not loading', data);

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const invalidBodyError = (data: unknown) => new QueryError('007', 'The body is not valid or upsupported', data);
