import { BaseArguments } from '../query/query.types';
import { Method } from '../request';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const v2ShouldCacheQuery = (method: Method) => {
  return method === 'GET' || method === 'OPTIONS' || method === 'HEAD' || method === 'GQL_QUERY';
};

/**
 * Builds the query store key for a request. `method` keeps two cacheable methods on one route
 * (a `HEAD` and an `OPTIONS`, a `GQL_QUERY` over POST and a plain `GET`) in separate entries.
 * Omitting it - or passing `GET` - yields the key a `GET` has always had.
 *
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const v2BuildQueryCacheKey = (route: string, args: BaseArguments | undefined, method?: Method) => {
  const variables = JSON.stringify(args?.variables || {})
    // replace all curly braces with empty string
    .replace(/{|}/g, '')
    // replace new lines and whitespaces with empty string
    .replace(/\s/g, '');

  const methodInput = method && method !== 'GET' ? `...${method}` : '';
  const seed = `${route}...${variables}${methodInput}`;

  let hash = 0;

  for (const char of seed) {
    hash = (Math.imul(31, hash) + char.charCodeAt(0)) << 0;
  }

  // Force positive number hash.
  // 2147483647 = equivalent of Integer.MAX_VALUE.
  hash += 2147483647 + 1;

  return hash.toString();
};
