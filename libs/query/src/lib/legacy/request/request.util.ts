import { isSymfonyPagerfantaOutOfRangeError } from '../../http';
import { invalidBaseRouteError, invalidRouteError, pathParamsMissingInRouteFunctionError } from '../logger';
import { AnyRoute } from '../query';
import {
  BuildQueryStringConfig,
  Method,
  PathParams,
  QueryParams,
  RequestError,
  RequestHeaders,
  RequestRetryFn,
} from './request.types';

export const isNaN = (value: unknown): boolean => typeof value === 'number' && Number.isNaN(value);
export const isEmptyString = (value: unknown): boolean => typeof value === 'string' && value.trim() === '';

export const isRequestError = <T = unknown>(error: unknown): error is RequestError<T> =>
  error instanceof Object && 'status' in error && 'statusText' in error && 'url' in error;

export const buildRoute = (options: {
  base: string;
  route: AnyRoute | null | undefined;
  pathParams?: PathParams;
  queryParams?: QueryParams;
  queryParamConfig?: BuildQueryStringConfig;
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
    const queryString = buildQueryString(options.queryParams, options.queryParamConfig);

    if (queryString) {
      route = route ? `${route}?${queryString}` : `/?${queryString}`;
    }
  }

  return `${options.base}${route ?? ''}`;
};

export const buildQueryString = (params: QueryParams, config?: BuildQueryStringConfig): string | null => {
  const objectNotation = config?.objectNotation ?? 'bracket';
  const writeArrayIndexes = config?.writeArrayIndexes ?? false;
  const ignoredValues = config?.ignoredValues ?? [undefined, null, Infinity, -Infinity];
  const ignoredValuesFns = config?.ignoredValuesFns ?? [isNaN, isEmptyString];

  const queryParams: string[] = [];

  function processValue(key: string, value: unknown) {
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
      for (const arrayValue of value) {
        const nestedKey = writeArrayIndexes ? `${key}[${currentFilteredIndex}]` : `${key}[]`;

        const didAddValue = processValue(nestedKey, arrayValue);

        if (didAddValue) {
          currentFilteredIndex++;
        }
      }

      return null;
    } else if (typeof value === 'object' && value !== null) {
      for (const [objKey, val] of Object.entries(value)) {
        const nestedKey = objectNotation === 'dot' ? `${key}.${objKey}` : `${key}[${objKey}]`;
        processValue(nestedKey, val);
      }

      return null;
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
    const m = cacheControl.split('max-age=')[1];

    if (m) {
      maxAge = parseInt(m);
    }
  } else if (cacheControl?.includes('s-maxage')) {
    const m = cacheControl.split('s-maxage=')[1];

    if (m) {
      maxAge = parseInt(m);
    }
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

export const serializeBody = (body: unknown): ArrayBuffer | URLSearchParams | Blob | FormData | string | null => {
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
    return body as ArrayBuffer | URLSearchParams | Blob | FormData | string;
  }

  if (typeof body === 'object' || typeof body === 'boolean' || Array.isArray(body)) {
    return JSON.stringify(body);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const { status, detail } = config.error;

  // Retry on 5xx errors
  if (status >= 500) {
    // Don't retry if a requested page is out of range
    if (isSymfonyPagerfantaOutOfRangeError(detail)) {
      return { retry: false };
    }

    return { retry: true, delay: defaultRetryDelay };
  }

  // Retry on 408 or 425 errors
  if (status === 408 || status === 425) {
    return { retry: true, delay: defaultRetryDelay };
  }

  // Retry on 429 errors
  if (status === 429) {
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

  // Code 0 usually means the internet connection is down. We retry in this case.
  // It could also be a CORS issue but that should not be the case in production.
  if ((status as number) === 0) {
    return { retry: true, delay: defaultRetryDelay };
  }

  return { retry: false };
};
