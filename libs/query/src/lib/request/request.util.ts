import {
  invalidBaseRouteError,
  invalidBodyError,
  invalidRouteError,
  pathParamsMissingInRouteFunctionError,
} from '../logger';
import { QueryParams, Params, RequestError, ParamArray, UnfilteredParamPrimitive, Method } from './request.types';

export const isRequestError = (error: unknown): error is RequestError =>
  error instanceof Object && 'code' in error && 'message' in error;

export const isAbortRequestError = (error: unknown): error is RequestError =>
  isRequestError(error) && error.code === -1;

export const buildRoute = (options: {
  base: string;
  route: ((args: Record<string, unknown>) => string) | string | null | undefined;
  pathParams?: Record<string, unknown>;
  queryParams?: QueryParams;
}) => {
  if (options.base.endsWith('/')) {
    throw invalidBaseRouteError(options.base);
  }

  let route: string | null = null;

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
    const queryString = buildQueryString(options.queryParams);

    if (queryString) {
      route = route ? `${route}?${queryString}` : `/?${queryString}`;
    }
  }

  return `${options.base}${route ?? ''}`;
};

export const buildQueryString = (params: QueryParams) => {
  const validParams = filterInvalidParams(params);

  const queryString = Object.keys(validParams)
    .map((key) =>
      Array.isArray(validParams[key])
        ? buildQueryArrayString(key, validParams[key] as ParamArray)
        : `${key}=${encodeURIComponent(validParams[key] as string | number | boolean)}`,
    )
    .join('&');

  return queryString || null;
};

export const buildQueryArrayString = (key: string, array: ParamArray) => {
  const uriBrackets = encodeURIComponent('[]');

  return array
    .slice()
    .map((item) => `${key}${uriBrackets}=${encodeURIComponent(item as string | number | boolean)}`)
    .join('&');
};

export const isFetchResponse = (response: unknown): response is Response =>
  typeof response === 'object' &&
  response !== null &&
  'status' in response &&
  'statusText' in response &&
  'json' in response &&
  typeof (response as Response)['json'] === 'function';

export const filterInvalidParams = (params: QueryParams) => {
  const filteredParams: Params = Object.entries(params)
    .map(([key, value]) => {
      if (!Array.isArray(value)) {
        return [key, value];
      }

      return [key, value.filter((v) => isParamValid(v))];
    })
    .filter(([, value]) => isParamValid(value as UnfilteredParamPrimitive))
    .reduce((acc, [key, value]) => ({ ...acc, [key as string]: value }), {});

  return filteredParams;
};

export const isParamValid = (primitive: UnfilteredParamPrimitive) => {
  if (primitive === undefined || primitive === null || primitive === '') {
    return false;
  }

  if (typeof primitive === 'string' && primitive.trim() === '') {
    return false;
  }

  if (typeof primitive === 'number' && isNaN(primitive)) {
    return false;
  }

  return true;
};

export const extractExpiresInSeconds = (headers: Headers) => {
  const cacheControl = headers.get('cache-control');
  const age = headers.get('age');
  const expires = headers.get('expires');

  // In seconds
  let expiresIn: number | null = null;
  let maxAge: number | null = null;

  if (cacheControl?.includes('no-cache')) {
    return null;
  }

  if (cacheControl?.includes('max-age')) {
    maxAge = parseInt(cacheControl.split('max-age=')[1]);
  } else if (cacheControl?.includes('s-maxage')) {
    maxAge = parseInt(cacheControl.split('s-maxage=')[1]);
  }

  if (maxAge && age) {
    const ageSeconds = parseInt(age);

    expiresIn = maxAge - ageSeconds;
  } else if (expires) {
    // Used by some apis to tell the response will never expire
    // In this case we let the response expire after 1 hour
    if (expires === '-1') {
      expiresIn = 3600;
    } else {
      const expiresDate = new Date(expires);

      // check if the date is valid
      if (expiresDate.toString() !== 'Invalid Date') {
        expiresIn = Math.floor((expiresDate.getTime() - Date.now()) / 1000);
      }
    }
  }

  return expiresIn;
};

export const buildTimestampFromSeconds = (seconds: number | null) => {
  if (seconds === null) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000).getTime();
};

export const buildRequestError = async <ErrorResponse = unknown>(error: unknown) => {
  if (error instanceof DOMException && error.code === error.ABORT_ERR) {
    const err: RequestError<null> = {
      code: -1,
      message: 'Request aborted',
      detail: null,
      raw: error,
    };

    return err;
  }

  if (error instanceof SyntaxError) {
    const err: RequestError<null> = {
      code: -3,
      message: 'Syntax error',
      detail: null,
      raw: error,
    };

    return err;
  }

  if (error instanceof Error) {
    const err: RequestError<null> = {
      code: -2,
      message: `${error.name}: ${error.message}`,
      detail: null,
      raw: error,
    };

    return err;
  }

  if (isFetchResponse(error)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detail: any;

    try {
      detail = await error.text();
    } catch (err) {
      detail = null;
    }

    const err: RequestError<ErrorResponse> = {
      code: error.status,
      message: error.statusText,
      detail,
      raw: error,
    };

    return err;
  }

  const err: RequestError<null> = {
    code: 0,
    message: 'Unknown error',
    detail: null,
    raw: error,
  };

  return err;
};

export const buildBody = (body: unknown) => {
  if (body === undefined || body === null) {
    return null;
  }

  if (typeof body === 'string') {
    return body;
  }

  if (typeof body === 'object') {
    return JSON.stringify(body);
  }

  if (body instanceof FormData) {
    return body;
  }

  throw invalidBodyError(body);
};

export const transformMethod = (method: Method) => {
  if (method === 'GQL_QUERY' || method === 'GQL_MUTATE') {
    return 'POST';
  }

  return method;
};

export const guessContentType = (body: unknown) => {
  if (body === null || body === undefined) {
    return null;
  }

  if (typeof body === 'string') {
    return 'text/plain';
  }

  if (body instanceof FormData) {
    return 'multipart/form-data';
  }

  if (typeof body === 'object') {
    return 'application/json';
  }

  return null;
};
