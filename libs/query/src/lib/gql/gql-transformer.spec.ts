import { isDevMode } from '@angular/core';
import { gql, transformGql } from './gql-transformer';

vi.mock('@angular/core', async () => {
  const actual = await vi.importActual('@angular/core');
  return {
    ...actual,
    isDevMode: vi.fn(),
  };
});

describe('transformGql', () => {
  beforeEach(() => {
    vi.mocked(isDevMode).mockReturnValue(true);
  });

  describe('basic functionality', () => {
    it('should transform a simple query string', () => {
      const query = 'query GetUser { user { id name } }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.query).toBe(query);
    });

    it('should transform an array of strings', () => {
      const queryParts = ['query GetUser { ', 'user { id name } ', '}'];
      const transformer = transformGql(queryParts);
      const result = transformer(null);

      expect(result.query).toBe(queryParts.join(''));
    });

    it('should return a transformer function', () => {
      const transformer = transformGql('query { user { id } }');

      expect(typeof transformer).toBe('function');
    });
  });

  describe('variables handling', () => {
    it('should add variables when provided', () => {
      const query = 'query GetUser($id: ID!) { user(id: $id) { name } }';
      const transformer = transformGql(query);
      const variables = { id: '123' };
      const result = transformer(variables);

      expect(result.variables).toBe(JSON.stringify(variables));
      expect(result.query).toBe(query);
    });

    it('should handle complex variables', () => {
      const query = 'query GetUsers($filter: UserFilter!) { users(filter: $filter) { id } }';
      const transformer = transformGql(query);
      const variables = {
        filter: {
          name: 'John',
          age: { gte: 18 },
          tags: ['active', 'premium'],
        },
      };
      const result = transformer(variables);

      expect(result.variables).toBe(JSON.stringify(variables));
    });

    it('should not add variables when null', () => {
      const query = 'query GetUsers { users { id } }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.variables).toBeUndefined();
    });

    it('should not add variables when undefined', () => {
      const query = 'query GetUsers { users { id } }';
      const transformer = transformGql(query);
      const result = transformer(undefined);

      expect(result.variables).toBeUndefined();
    });

    it('should handle empty object variables', () => {
      const query = 'query GetUsers { users { id } }';
      const transformer = transformGql(query);
      const result = transformer({});

      expect(result.variables).toBe('{}');
    });
  });

  describe('operation name extraction', () => {
    it('should extract operation name from named query', () => {
      const query = 'query GetUser() { user { id } }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.operationName).toBe('GetUser');
    });

    it('should extract operation name from named mutation', () => {
      const query = 'mutation CreateUser() { createUser { id } }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.operationName).toBe('CreateUser');
    });

    it('should extract operation name from query with parameters', () => {
      const query = 'query GetUser($id: ID!) { user(id: $id) { name } }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.operationName).toBe('GetUser');
    });

    it('should extract operation name with hyphens and underscores', () => {
      const query = 'query Get_User-Name() { user { id } }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.operationName).toBe('Get_User-Name');
    });

    it('should extract operation name with numbers', () => {
      const query = 'query GetUser123() { user { id } }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.operationName).toBe('GetUser123');
    });

    it('should not add operation name for anonymous query', () => {
      const query = 'query { user { id } }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.operationName).toBeUndefined();
    });

    it('should not add operation name for anonymous mutation', () => {
      const query = 'mutation { createUser { id } }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.operationName).toBeUndefined();
    });

    it('should handle query with extra whitespace', () => {
      const query = 'query GetUser (  $id:  ID!  ) { user { id } }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.operationName).toBe('GetUser');
    });

    it('should handle query with newlines', () => {
      const query = `query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }`;
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.operationName).toBe('GetUser');
    });
  });

  describe('query minification', () => {
    it('should minify query in production mode', () => {
      vi.mocked(isDevMode).mockReturnValue(false);

      const query = `query GetUser {
        user {
          id
          name
          email
        }
      }`;
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.query).toBe('query GetUser { user { id name email } }');
    });

    it('should not minify query in development mode', () => {
      vi.mocked(isDevMode).mockReturnValue(true);

      const query = `query GetUser {
        user {
          id
          name
        }
      }`;
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.query).toBe(query);
    });

    it('should handle multiple spaces in production', () => {
      vi.mocked(isDevMode).mockReturnValue(false);

      const query = 'query    GetUser    {    user    {    id    }    }';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.query).toBe('query GetUser { user { id } }');
    });

    it('should trim whitespace in production', () => {
      vi.mocked(isDevMode).mockReturnValue(false);

      const query = '  query GetUser { user { id } }  ';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.query).toBe('query GetUser { user { id } }');
    });
  });

  describe('complete transformations', () => {
    it('should handle complete query with all features', () => {
      const query = `query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
          email
        }
      }`;
      const transformer = transformGql(query);
      const variables = { id: '123' };
      const result = transformer(variables);

      expect(result.query).toBe(query); // dev mode
      expect(result.variables).toBe(JSON.stringify(variables));
      expect(result.operationName).toBe('GetUser');
    });

    it('should handle mutation with all features', () => {
      const query = 'mutation CreateUser($input: UserInput!) { createUser(input: $input) { id } }';
      const transformer = transformGql(query);
      const variables = { input: { name: 'John', email: 'john@example.com' } };
      const result = transformer(variables);

      expect(result.query).toBe(query);
      expect(result.variables).toBe(JSON.stringify(variables));
      expect(result.operationName).toBe('CreateUser');
    });

    it('should handle fragment definitions', () => {
      const query = `
        fragment UserFields on User {
          id
          name
        }
        query GetUser() {
          user {
            ...UserFields
          }
        }
      `;
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.query).toContain('fragment UserFields');
      expect(result.operationName).toBe('GetUser');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const transformer = transformGql('');
      const result = transformer(null);

      expect(result.query).toBe('');
      expect(result.operationName).toBeUndefined();
    });

    it('should handle empty array', () => {
      const transformer = transformGql([]);
      const result = transformer(null);

      expect(result.query).toBe('');
    });

    it('should handle query without braces', () => {
      const query = 'query GetUser';
      const transformer = transformGql(query);
      const result = transformer(null);

      expect(result.query).toBe(query);
      expect(result.operationName).toBeUndefined();
    });
  });
});

describe('gql', () => {
  it('should create a tagged template literal', () => {
    const result = gql`
      query GetUser {
        user {
          id
        }
      }
    `;

    expect(typeof result).toBe('string');
    expect(result).toContain('query GetUser');
    expect(result).toContain('user');
    expect(result).toContain('id');
  });

  it('should handle interpolated values', () => {
    const fieldName = 'name';
    const result = gql`query GetUser { user { id ${fieldName} } }`;

    expect(result).toBe('query GetUser { user { id name } }');
  });

  it('should handle multiple interpolations', () => {
    const type = 'query';
    const name = 'GetUser';
    const field = 'email';
    const result = gql`${type} ${name} { user { id ${field} } }`;

    expect(result).toBe('query GetUser { user { id email } }');
  });

  it('should handle numeric interpolations', () => {
    const limit = 10;
    const result = gql`query GetUsers { users(limit: ${limit}) { id } }`;

    expect(result).toBe('query GetUsers { users(limit: 10) { id } }');
  });

  it('should handle null values', () => {
    const value = null;
    const result = gql`query GetUser { user(id: ${value}) { id } }`;

    expect(result).toBe('query GetUser { user(id: ) { id } }');
  });

  it('should handle undefined values', () => {
    const value = undefined;
    const result = gql`query GetUser { user(id: ${value}) { id } }`;

    expect(result).toBe('query GetUser { user(id: ) { id } }');
  });

  it('should handle multiline queries', () => {
    const result = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    expect(result).toContain('query GetUser');
    expect(result).toContain('id');
    expect(result).toContain('name');
  });

  it('should preserve whitespace', () => {
    const result = gql`
      query GetUser {
        user {
          id
        }
      }
    `;

    // The gql template literal preserves the original formatting
    expect(result).toContain('\n');
    expect(result).toContain('query GetUser');
  });

  it('should handle empty template', () => {
    const result = gql``;

    expect(result).toBe('');
  });

  it('should handle template with only interpolations', () => {
    const a = 'query';
    const b = 'GetUser';
    const result = gql`
      ${a}
      ${b}
    `;

    expect(result).toContain('query');
    expect(result).toContain('GetUser');
  });
});
