import { BaseArguments } from '../query/query.types';
import { buildGqlCacheKey, shouldCacheQuery } from './query-client.utils';

describe('buildGqlCacheKey', () => {
  it('should return a string with a shortened query and variables', () => {
    const query = `
      query MyQuery {
        user(id: $id) {
          name
          email
        }
      }
    `;

    const args: BaseArguments = {
      variables: {
        id: 123,
      },
    };

    const expectedCacheKey =
      'queryMyQuery{user(id:$id){nameemail}}...mail}}...queryMyQuery{user(id:$id){nameemail}}...{"id":123}';

    const cacheKey = buildGqlCacheKey({ query, method: 'GQL_QUERY' }, args);

    expect(cacheKey).toBe(expectedCacheKey);
  });

  it('should return a string without variables when variables are undefined', () => {
    const query = `
      query MyQuery {
        user(id: $id) {
          name
          email
        }
      }
    `;

    const expectedCacheKey =
      'queryMyQuery{user(id:$id){nameemail}}...mail}}...queryMyQuery{user(id:$id){nameemail}}...{}';

    const cacheKey = buildGqlCacheKey({ query, method: 'GQL_QUERY' }, undefined);

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
