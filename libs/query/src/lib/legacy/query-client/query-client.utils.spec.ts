import { BaseArguments } from '../query/query.types';
import { buildQueryCacheKey, shouldCacheQuery } from './query-client.utils';

describe('buildQueryCacheKey', () => {
  it('should return a string with a shortened query and variables', () => {
    const route = '/posts';
    const args: BaseArguments = {
      variables: {
        id: 123,
      },
    };

    const expectedCacheKey = '1769813287';

    const cacheKey = buildQueryCacheKey(route, args);

    expect(cacheKey).toBe(expectedCacheKey);
  });
});

describe('shouldCacheQuery', () => {
  it('should return true for GET requests', () => {
    const method = 'GET';

    const shouldCache = shouldCacheQuery(method);

    expect(shouldCache).toBe(true);
  });

  it('should return true for OPTIONS requests', () => {
    const method = 'OPTIONS';

    const shouldCache = shouldCacheQuery(method);

    expect(shouldCache).toBe(true);
  });

  it('should return true for HEAD requests', () => {
    const method = 'HEAD';

    const shouldCache = shouldCacheQuery(method);

    expect(shouldCache).toBe(true);
  });

  it('should return true for GQL_QUERY requests', () => {
    const method = 'GQL_QUERY';

    const shouldCache = shouldCacheQuery(method);

    expect(shouldCache).toBe(true);
  });

  it('should return false for other HTTP methods', () => {
    const method = 'POST';

    const shouldCache = shouldCacheQuery(method);

    expect(shouldCache).toBe(false);
  });
});
