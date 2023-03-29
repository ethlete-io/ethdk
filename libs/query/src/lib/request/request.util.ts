import { invalidBaseRouteError, invalidRouteError, pathParamsMissingInRouteFunctionError } from '../logger';
import {
  Method,
  ParamArray,
  Params,
  QueryParams,
  RequestError,
  RequestHeaders,
  RequestRetryFn,
  UnfilteredParamPrimitive,
} from './request.types';

export const isRequestError = <T = unknown>(error: unknown): error is RequestError<T> =>
  error instanceof Object && 'status' in error && 'statusText' in error && 'url' in error;

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

export const buildQueryString = (params: QueryParams): string | null => {
  const validParams = filterInvalidParams(params);

  const queryString = Object.keys(validParams)
    .map((key) => {
      if (Array.isArray(validParams[key])) {
        return buildQueryArrayString(key, validParams[key] as ParamArray);
      }

      if (typeof validParams[key] === 'object' && validParams[key] !== null) {
        return buildQueryObjectString(key, validParams[key] as unknown as QueryParams);
      }

      return `${key}=${encodeURIComponent(validParams[key] as string | number | boolean)}`;
    })
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

export const buildQueryObjectString = (key: string, object: QueryParams): string => {
  const uriBracketStart = encodeURIComponent(`${key}[`);
  const uriBracketEnd = encodeURIComponent(`]`);

  return Object.keys(object)
    .map((k) => {
      const key = `${uriBracketStart}${k}${uriBracketEnd}`;

      if (Array.isArray(object[k])) {
        return buildQueryArrayString(key, object[k] as ParamArray);
      }

      if (typeof object[k] === 'object' && object[k] !== null) {
        return buildQueryObjectString(key, object[k] as unknown as QueryParams);
      }

      return `${key}=${encodeURIComponent(object[k] as string | number | boolean)}`;
    })
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
      if (typeof value === 'object' && value !== null) {
        return [key, filterInvalidParams(value as QueryParams)];
      } else if (!Array.isArray(value)) {
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

export const extractExpiresInSeconds = (headers: RequestHeaders) => {
  const cacheControl = headers['cache-control'];
  const age = headers['age'];
  const expires = headers['expires'];

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
  } else if (maxAge) {
    expiresIn = maxAge / 2; // We assume the response is half way to its expiration
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

export const serializeBody = (body: unknown): ArrayBuffer | Blob | FormData | string | null => {
  if (body === null || body === undefined) {
    return null;
  }

  if (
    body instanceof ArrayBuffer ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    typeof body === 'string'
  ) {
    return body;
  }

  if (typeof body === 'object' || typeof body === 'boolean' || Array.isArray(body)) {
    return JSON.stringify(body);
  }

  return (body as any).toString();
};

export const transformMethod = (config: { method: Method; transferVia?: 'GET' | 'POST' }) => {
  if (config.method === 'GQL_QUERY' || config.method === 'GQL_MUTATE') {
    if (!config.transferVia) {
      return 'POST';
    }

    return config.transferVia;
  }

  return config.method;
};

export const detectContentTypeHeader = (body: unknown) => {
  // An empty body has no content type.
  if (body === null) {
    return null;
  }
  // FormData bodies rely on the browser's content type assignment.
  if (body instanceof FormData) {
    return null;
  }
  // Blobs usually have their own content type. If it doesn't, then
  // no type can be inferred.
  if (body instanceof Blob) {
    return body.type || null;
  }
  // Array buffers have unknown contents and thus no type can be inferred.
  if (body instanceof ArrayBuffer) {
    return null;
  }
  // Technically, strings could be a form of JSON data, but it's safe enough
  // to assume they're plain strings.
  if (typeof body === 'string') {
    return 'text/plain';
  }

  // Arrays, objects, boolean and numbers will be encoded as JSON.
  if (typeof body === 'object' || typeof body === 'number' || typeof body === 'boolean') {
    return 'application/json';
  }
  // No type could be inferred.
  return null;
};

export const hasHeader = (headers: RequestHeaders, header: string) => {
  return Object.keys(headers).some((key) => key.toLowerCase() === header.toLowerCase());
};

export const forEachHeader = (headers: RequestHeaders, callback: (value: string, key: string) => void) => {
  Object.entries(headers).forEach(([key, value]) => {
    callback(key, value);
  });
};

export const parseAllXhrResponseHeaders = (xhr: XMLHttpRequest) => {
  const headers = xhr.getAllResponseHeaders();
  const parsedHeaders: RequestHeaders = {};

  for (const line of headers.split('\n')) {
    const index = line.indexOf(':');
    if (index > 0) {
      const name = line.slice(0, index);
      const key = name.toLowerCase();
      const value = line.slice(index + 1).trim();

      parsedHeaders[key] = value;
    }
  }

  return parsedHeaders;
};

export const getResponseUrl = (xhr: XMLHttpRequest): string | null => {
  if ('responseURL' in xhr && xhr.responseURL) {
    return xhr.responseURL;
  }
  if (/^X-Request-URL:/m.test(xhr.getAllResponseHeaders())) {
    return xhr.getResponseHeader('X-Request-URL');
  }
  return null;
};

export const shouldRetryRequest: RequestRetryFn = (config) => {
  const defaultRetryDelay = 1000 + 1000 * config.currentRetryCount;

  if (config.currentRetryCount > 3) {
    return { retry: false };
  }

  if (!isRequestError(config.error)) {
    return { retry: false };
  }

  const { status } = config.error;

  // Retry on 5xx errors
  if (status >= 500) {
    return { retry: true, delay: defaultRetryDelay };
  }

  // Retry on 408 or 425 errors
  if (status === HttpStatusCode.RequestTimeout || status === HttpStatusCode.TooEarly) {
    return { retry: true, delay: defaultRetryDelay };
  }

  // Retry on 429 errors
  if (status === HttpStatusCode.TooManyRequests) {
    const retryAfter =
      config.headers['retry-after'] ||
      config.headers['Retry-After'] ||
      config.headers['x-retry-after'] ||
      config.headers['X-Retry-After'];

    if (retryAfter) {
      const delay = parseInt(retryAfter) * 1000;
      return { retry: true, delay: Number.isNaN(delay) ? defaultRetryDelay : delay };
    }

    return { retry: true, delay: defaultRetryDelay };
  }

  return { retry: false };
};

export const enum HttpStatusCode {
  Unknown = 0,

  Continue = 100,
  SwitchingProtocols = 101,
  Processing = 102,
  EarlyHints = 103,

  Ok = 200,
  Created = 201,
  Accepted = 202,
  NonAuthoritativeInformation = 203,
  NoContent = 204,
  ResetContent = 205,
  PartialContent = 206,
  MultiStatus = 207,
  AlreadyReported = 208,
  ImUsed = 226,

  MultipleChoices = 300,
  MovedPermanently = 301,
  Found = 302,
  SeeOther = 303,
  NotModified = 304,
  UseProxy = 305,
  Unused = 306,
  TemporaryRedirect = 307,
  PermanentRedirect = 308,

  BadRequest = 400,
  Unauthorized = 401,
  PaymentRequired = 402,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  NotAcceptable = 406,
  ProxyAuthenticationRequired = 407,
  RequestTimeout = 408,
  Conflict = 409,
  Gone = 410,
  LengthRequired = 411,
  PreconditionFailed = 412,
  PayloadTooLarge = 413,
  UriTooLong = 414,
  UnsupportedMediaType = 415,
  RangeNotSatisfiable = 416,
  ExpectationFailed = 417,
  ImATeapot = 418,
  MisdirectedRequest = 421,
  UnprocessableEntity = 422,
  Locked = 423,
  FailedDependency = 424,
  TooEarly = 425,
  UpgradeRequired = 426,
  PreconditionRequired = 428,
  TooManyRequests = 429,
  RequestHeaderFieldsTooLarge = 431,
  UnavailableForLegalReasons = 451,

  InternalServerError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
  GatewayTimeout = 504,
  HttpVersionNotSupported = 505,
  VariantAlsoNegotiates = 506,
  InsufficientStorage = 507,
  LoopDetected = 508,
  NotExtended = 510,
  NetworkAuthenticationRequired = 511,
}
