import { RuntimeError } from '@ethlete/core';

/**
 * Route building, query-string serialization and the token clock - shared by the current generation and
 * the legacy V2 client, which re-exports them under their original names.
 */

// codes 1-99 of the shared 0-999 `@ethlete/query` range - see `query-errors.ts` for the rest
export const RouteRuntimeErrorCode = {
  INVALID_BASE_ROUTE: 1,
  INVALID_ROUTE: 2,
  PATH_PARAMS_MISSING_IN_ROUTE_FUNCTION: 3,
} as const;

export type RouteRuntimeErrorCode = (typeof RouteRuntimeErrorCode)[keyof typeof RouteRuntimeErrorCode];

export const invalidBaseRouteError = (data: unknown) =>
  new RuntimeError(RouteRuntimeErrorCode.INVALID_BASE_ROUTE, 'The baseRoute must not end with a slash', data);

export const invalidRouteError = (data: unknown) =>
  new RuntimeError(RouteRuntimeErrorCode.INVALID_ROUTE, 'The route must start with a slash', data);

export const pathParamsMissingInRouteFunctionError = (data: unknown) =>
  new RuntimeError(
    RouteRuntimeErrorCode.PATH_PARAMS_MISSING_IN_ROUTE_FUNCTION,
    'The route is a function but pathParams are missing',
    data,
  );

export type QueryParams = object;
export type PathParams = Record<string, string | number>;

/** A literal route, or a function building one from path params. Structurally the legacy `AnyRoute`. */
export type RouteInput = ((pathParams: PathParams) => string) | `/${string}`;

export type BuildQueryStringConfig = {
  /**
   * Object notation to use for nested objects.
   *
   * @example
   * // dot notation
   * { foo: { bar: 'baz' } } => "foo.bar=baz"
   *
   * @example
   * // bracket notation
   * { foo: { bar: 'baz' } } => "foo[bar]=baz"
   *
   * @example
   * // json-stringify notation
   * { foo: { bar: 'baz' } } => "foo={\"bar\":\"baz\"}"
   *
   * @default 'bracket'
   */
  objectNotation?: 'dot' | 'bracket' | 'json-stringify';

  /**
   * Whether to write array indexes in bracket notation.
   *
   * @example
   * // true
   * { foo: ['bar', 'baz'] } => "foo[0]=bar&foo[1]=baz"
   *
   * @example
   * // false
   * { foo: ['bar', 'baz'] } => "foo[]=bar&foo[]=baz"
   *
   * @default false
   */
  writeArrayIndexes?: boolean;

  /**
   * A list of values that should be ignored when building the query string.
   *
   * Also have a look at `ignoredValuesFns`.
   *
   * @default [undefined, null, Infinity, -Infinity]
   */
  ignoredValues?: Array<unknown>;

  /**
   * A list of functions that should be used to determine whether a value should be ignored when building the query string.
   *
   * Also have a look at `ignoredValues`.
   *
   * @default [isNaN, isEmptyString]
   */
  ignoredValuesFns?: Array<(value: unknown) => boolean>;
};

export const isNaN = (value: unknown): boolean => typeof value === 'number' && Number.isNaN(value);
export const isEmptyString = (value: unknown) => typeof value === 'string' && value.trim() === '';

export const buildQueryString = (params: QueryParams, config?: BuildQueryStringConfig): string | null => {
  const objectNotation = config?.objectNotation ?? 'bracket';
  const writeArrayIndexes = config?.writeArrayIndexes ?? false;
  const ignoredValues = config?.ignoredValues ?? [undefined, null, Infinity, -Infinity];
  const ignoredValuesFns = config?.ignoredValuesFns ?? [isNaN, isEmptyString];

  const queryParams: string[] = [];

  function processValue(key: string, value: unknown): boolean | void {
    if (config?.objectNotation === 'json-stringify') {
      if (value === undefined) {
        return false;
      }

      if (ignoredValues.includes(value)) {
        return false;
      }

      if (ignoredValuesFns.some((fn) => fn(value))) {
        return false;
      }

      const encodedKey = encodeURIComponent(key);

      const val = typeof value === 'object' ? JSON.stringify(value) : value;

      const encodedValue = encodeURIComponent(val as string | number | boolean);

      queryParams.push(`${encodedKey}=${encodedValue}`);

      return true;
    } else if (Array.isArray(value)) {
      let currentFilteredIndex = 0;
      let didAddAnyValue = false;
      for (const arrayValue of value) {
        const nestedKey = writeArrayIndexes ? `${key}[${currentFilteredIndex}]` : `${key}[]`;

        const didAddValue = processValue(nestedKey, arrayValue);

        if (didAddValue) {
          currentFilteredIndex++;
          didAddAnyValue = true;
        }
      }

      return didAddAnyValue;
    } else if (typeof value === 'object' && value !== null) {
      let didAddAnyValue = false;
      for (const [objKey, val] of Object.entries(value)) {
        const nestedKey = objectNotation === 'dot' ? `${key}.${objKey}` : `${key}[${objKey}]`;
        didAddAnyValue = processValue(nestedKey, val) || didAddAnyValue;
      }

      return didAddAnyValue;
    } else {
      if (ignoredValues.includes(value)) {
        return false;
      }

      if (ignoredValuesFns.some((fn) => fn(value))) {
        return false;
      }

      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(value as string);

      queryParams.push(`${encodedKey}=${encodedValue}`);

      return true;
    }
  }

  for (const [key, val] of Object.entries(params)) {
    processValue(key, val);
  }

  return queryParams.length ? queryParams.join('&') : null;
};

export const buildRoute = (options: {
  base: string;
  route: RouteInput | null | undefined;
  pathParams?: PathParams;
  queryParams?: QueryParams;
  queryParamConfig?: BuildQueryStringConfig;
}) => {
  if (options.base.endsWith('/')) {
    throw invalidBaseRouteError(options.base);
  }

  let route: string | null;

  if (typeof options.route === 'function') {
    if (!options.pathParams) {
      throw pathParamsMissingInRouteFunctionError(options.route({}));
    }

    route = options.route(options.pathParams);
  } else {
    route = options.route ?? null;
  }

  if (route && !route.startsWith('/')) {
    throw invalidRouteError(route);
  }

  if (options.queryParams) {
    const queryString = buildQueryString(options.queryParams, options.queryParamConfig);

    if (queryString) {
      route = route ? `${route}?${queryString}` : `/?${queryString}`;
    }
  }

  return `${options.base}${route ?? ''}`;
};

export const buildTimestampFromSeconds = (seconds: number | null) => {
  if (seconds === null) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000).getTime();
};

/** Reads a bearer token's payload. */
export const decryptBearer = <Result = Record<string, unknown>>(token: string) => {
  try {
    const base64Url = token.split('.')[1];

    if (!base64Url) {
      return null;
    }

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );

    return JSON.parse(jsonPayload) as Result;
  } catch (error) {
    console.error('Invalid bearer token', error);

    return null;
  }
};
