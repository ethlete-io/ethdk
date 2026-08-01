import { QueryError } from '../../http/internal/request-route';

export {
  buildErrorMessage,
  invalidBaseRouteError,
  invalidRouteError,
  pathParamsMissingInRouteFunctionError,
  QueryError,
} from '../../http/internal/request-route';

export const queryStateAlreadyHasKeyError = (data: unknown) =>
  new QueryError('004', 'The query state already contains the provided key', data);

export const queryStateDoesNotContainKeyError = (data: unknown) =>
  new QueryError('005', 'The query state does not contain the provided key', data);

export const queryStateCannotTransformError = (data: unknown) =>
  new QueryError('006', 'The query state cannot be transformed because it is not loading', data);

export const invalidBodyError = (data: unknown) => new QueryError('007', 'The body is not valid or upsupported', data);
