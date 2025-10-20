import { BaseArguments } from '../query/query.types';
import { Method } from '../request';

export const shouldCacheQuery = (method: Method) => {
  return method === 'GET' || method === 'OPTIONS' || method === 'HEAD' || method === 'GQL_QUERY';
};

export const buildQueryCacheKey = (route: string, args: BaseArguments | undefined) => {
  const variables = JSON.stringify(args?.variables || {})
    // replace all curly braces with empty string
    .replace(/{|}/g, '')
    // replace new lines and whitespaces with empty string
    .replace(/\s/g, '');

  const seed = `${route}...${variables}`;

  let hash = 0;

  for (const char of seed) {
    hash = (Math.imul(31, hash) + char.charCodeAt(0)) << 0;
  }

  // Force positive number hash.
  // 2147483647 = equivalent of Integer.MAX_VALUE.
  hash += 2147483647 + 1;

  return hash.toString();
};
