import { HttpHeaders } from '@angular/common/http';
import { QueryArgs, RequestArgs } from './query';
import { QueryMethod } from './query-creator';

export const extractExpiresInSeconds = (headers: HttpHeaders) => {
  const cacheControl = headers.get('cache-control');
  const age = headers.get('age');
  const expires = headers.get('expires');

  // In seconds
  let expiresIn: number | null = null;
  let maxAge: number | null = null;

  if (cacheControl && /(?:^|,)\s*no-(?:cache|store)(?:\s|,|$)/i.test(cacheControl)) {
    return null;
  }

  const maxAgeMatch = cacheControl?.match(/(?:^|,)\s*(?:s-maxage|max-age)=(\d+)/i);

  if (maxAgeMatch?.[1]) {
    maxAge = parseInt(maxAgeMatch[1]);
  }

  if (maxAge !== null && age) {
    const ageSeconds = parseInt(age);

    expiresIn = Math.max(maxAge - ageSeconds, 0);
  } else if (maxAge !== null) {
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

export const shouldCacheQuery = (method: QueryMethod) => {
  return method === 'GET' || method === 'OPTIONS' || method === 'HEAD';
};

const sortObjectKeys = (_key: string, value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const record = value as Record<string, unknown>;

  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((name) => [name, record[name]]),
  );
};

/**
 * Builds the repository cache key for a request. `method` keeps two cacheable methods on one route
 * (a `HEAD` and an `OPTIONS`, a GraphQL query over POST and a plain `GET`) in separate entries.
 * Omitting it - or passing `GET` - yields the key a `GET` has always had, which is what persisted
 * entries written by an older version are stored under.
 */
export const buildQueryCacheKey = (route: string, args: RequestArgs<QueryArgs> | undefined, method?: QueryMethod) => {
  const headers = typeof args?.headers === 'function' ? args.headers() : args?.headers;
  const serializedHeaders = headers
    ?.keys()
    .map((name) => name.toLowerCase())
    .filter((name) => name !== 'authorization')
    .sort()
    .map((name) => [name, headers.getAll(name)]);

  const serializedBody = JSON.stringify(args?.body || {}, sortObjectKeys);
  const body = serializedBody === '{}' ? '' : serializedBody;

  const headerInput = serializedHeaders?.length ? `_${JSON.stringify(serializedHeaders)}` : '';
  const methodInput = method && method !== 'GET' ? `_${method}` : '';
  const seed = `${route}_${body}${headerInput}${methodInput}`;

  let hash = 0;
  let secondaryHash = 5381;

  for (const char of seed) {
    hash = (Math.imul(31, hash) + char.charCodeAt(0)) << 0;
    secondaryHash = Math.imul(33, secondaryHash) ^ char.charCodeAt(0);
  }

  return `${(hash >>> 0).toString().padStart(10, '0')}${(secondaryHash >>> 0).toString().padStart(10, '0')}`;
};
