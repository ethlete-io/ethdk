import { isSymfonyPagerfantaOutOfRangeError } from '../../http/query-error-response-utils';
import { Method, RequestError, RequestHeaders, RequestRetryFn } from './request.types';

export {
  buildQueryString,
  buildRoute,
  buildTimestampFromSeconds,
  isEmptyString,
  isNaN,
} from '../../http/internal/request-route';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const isRequestError = <T = unknown>(error: unknown): error is RequestError<T> =>
  error instanceof Object && 'status' in error && 'statusText' in error && 'url' in error;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const v2ExtractExpiresInSeconds = (headers: RequestHeaders) => {
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

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
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

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const transformMethod = (config: { method: Method; transferVia?: 'GET' | 'POST' }) => {
  if (config.method === 'GQL_QUERY' || config.method === 'GQL_MUTATE') {
    if (!config.transferVia) {
      return 'POST';
    }

    return config.transferVia;
  }

  return config.method;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
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

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const hasHeader = (headers: RequestHeaders, header: string) => {
  return Object.keys(headers).some((key) => key.toLowerCase() === header.toLowerCase());
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const forEachHeader = (headers: RequestHeaders, callback: (value: string, key: string) => void) => {
  Object.entries(headers).forEach(([key, value]) => {
    callback(key, value);
  });
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
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

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const getResponseUrl = (xhr: XMLHttpRequest): string | null => {
  if ('responseURL' in xhr && xhr.responseURL) {
    return xhr.responseURL;
  }
  if (/^X-Request-URL:/m.test(xhr.getAllResponseHeaders())) {
    return xhr.getResponseHeader('X-Request-URL');
  }
  return null;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const v2ShouldRetryRequest: RequestRetryFn = (config) => {
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
