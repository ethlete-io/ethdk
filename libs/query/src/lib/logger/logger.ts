export const buildErrorMessage = (code: string, message: string) => `[@ethlete\\query:${code}] ${message}`;

export class QueryError extends Error {
  data?: unknown;

  constructor(code: string, message: string, data?: unknown) {
    super(buildErrorMessage(code, message));
    this.name = 'QueryError';
    this.data = data;
  }
}

export const invalidBaseRouteError = (data: unknown) =>
  new QueryError('001', 'The baseRoute must not end with a slash', data);

export const invalidRouteError = (data: unknown) => new QueryError('002', 'The route must start with a slash', data);

export const pathParamsMissingInRouteFunctionError = (data: unknown) =>
  new QueryError('003', 'The route is a function but pathParams are missing', data);

export const queryStateAlreadyHasKeyError = (data: unknown) =>
  new QueryError('004', 'The query state already contains the provided key', data);

export const queryStateDoesNotContainKeyError = (data: unknown) =>
  new QueryError('005', 'The query state does not contain the provided key', data);

export const queryStateCannotTransformError = (data: unknown) =>
  new QueryError('006', 'The query state cannot be transformed because it is not loading', data);

export const invalidBodyError = (data: unknown) => new QueryError('007', 'The body is not valid or upsupported', data);
