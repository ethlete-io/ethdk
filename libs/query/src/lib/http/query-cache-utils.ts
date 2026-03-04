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

export const shouldCacheQuery = (method: QueryMethod) => {
  return method === 'GET' || method === 'OPTIONS' || method === 'HEAD';
};

export const buildQueryCacheKey = (route: string, args: RequestArgs<QueryArgs> | undefined) => {
  // We need to hash the body in case it's a gql query and the query get's transported in the body
  const body = JSON.stringify(args?.body || {})
    // replace all curly braces with empty string
    .replace(/{|}/g, '')
    // replace new lines and whitespaces with empty string
    .replace(/\s/g, '');

  const seed = `${route}_${body}`;

  let hash = 0;

  for (const char of seed) {
    hash = (Math.imul(31, hash) + char.charCodeAt(0)) << 0;
  }

  // Force positive number hash.
  // 2147483647 = equivalent of Integer.MAX_VALUE.
  hash += 2147483647 + 1;

  return hash.toString();
};
