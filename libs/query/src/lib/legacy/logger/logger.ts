import { RuntimeError } from '@ethlete/core';
import { QueryRuntimeErrorCode } from '../../http/query-errors';

export {
  invalidBaseRouteError,
  invalidRouteError,
  pathParamsMissingInRouteFunctionError,
} from '../../http/internal/request-route';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const queryStateAlreadyHasKeyError = (data: unknown) =>
  new RuntimeError(
    QueryRuntimeErrorCode.LEGACY_QUERY_STATE_ALREADY_HAS_KEY,
    'The query state already contains the provided key',
    data,
  );

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const queryStateDoesNotContainKeyError = (data: unknown) =>
  new RuntimeError(
    QueryRuntimeErrorCode.LEGACY_QUERY_STATE_DOES_NOT_CONTAIN_KEY,
    'The query state does not contain the provided key',
    data,
  );

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const queryStateCannotTransformError = (data: unknown) =>
  new RuntimeError(
    QueryRuntimeErrorCode.LEGACY_QUERY_STATE_CANNOT_TRANSFORM,
    'The query state cannot be transformed because it is not loading',
    data,
  );

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const invalidBodyError = (data: unknown) =>
  new RuntimeError(QueryRuntimeErrorCode.LEGACY_INVALID_BODY, 'The body is not valid or upsupported', data);
