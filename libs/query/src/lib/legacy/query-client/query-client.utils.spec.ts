import { BaseArguments } from '../query/query.types';
import { v2BuildQueryCacheKey, v2ShouldCacheQuery } from './query-client.utils';

describe('buildQueryCacheKey', () => {
  it('should return a string with a shortened query and variables', () => {
    const route = '/posts';
    const args: BaseArguments = {
      variables: {
        id: 123,
      },
    };

    const expectedCacheKey = '1769813287';

    const cacheKey = v2BuildQueryCacheKey(route, args);

    expect(cacheKey).toBe(expectedCacheKey);
  });

  it('should keep the key a GET has always had', () => {
    const route = '/posts';
    const args: BaseArguments = {
      variables: {
        id: 123,
      },
    };

    expect(v2BuildQueryCacheKey(route, args, 'GET')).toBe('1769813287');
    expect(v2BuildQueryCacheKey(route, args)).toBe('1769813287');
  });

  it('should give two cacheable methods on one route different keys', () => {
    const route = '/posts';
    const args: BaseArguments = {
      variables: {
        id: 123,
      },
    };

    const headKey = v2BuildQueryCacheKey(route, args, 'HEAD');
    const optionsKey = v2BuildQueryCacheKey(route, args, 'OPTIONS');
    const gqlKey = v2BuildQueryCacheKey(route, args, 'GQL_QUERY');
    const getKey = v2BuildQueryCacheKey(route, args, 'GET');

    expect(new Set([headKey, optionsKey, gqlKey, getKey]).size).toBe(4);
  });
});

describe('shouldCacheQuery', () => {
  it('should return true for GET requests', () => {
    const method = 'GET';

    const shouldCache = v2ShouldCacheQuery(method);

    expect(shouldCache).toBe(true);
  });

  it('should return true for OPTIONS requests', () => {
    const method = 'OPTIONS';

    const shouldCache = v2ShouldCacheQuery(method);

    expect(shouldCache).toBe(true);
  });

  it('should return true for HEAD requests', () => {
    const method = 'HEAD';

    const shouldCache = v2ShouldCacheQuery(method);

    expect(shouldCache).toBe(true);
  });

  it('should return true for GQL_QUERY requests', () => {
    const method = 'GQL_QUERY';

    const shouldCache = v2ShouldCacheQuery(method);

    expect(shouldCache).toBe(true);
  });

  it('should return false for other HTTP methods', () => {
    const method = 'POST';

    const shouldCache = v2ShouldCacheQuery(method);

    expect(shouldCache).toBe(false);
  });
});
