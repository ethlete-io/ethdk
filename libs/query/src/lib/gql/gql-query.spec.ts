import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient } from '../http';
import { createGqlQuery, isCreateGqlQueryOptions } from './gql-query';
import { InternalCreateGqlQueryCreatorOptions } from './gql-query-creator';
import { gql } from './gql-transformer';

describe('createGqlQuery', () => {
  let client: ReturnType<typeof createQueryClient>;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create a GQL query', () => {
    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    const internals: InternalCreateGqlQueryCreatorOptions = {
      method: 'QUERY',
      transport: 'POST',
      client: client,
      query,
    };

    TestBed.runInInjectionContext(() => {
      const gqlQuery = createGqlQuery({
        creatorInternals: internals,
        features: [],
        queryConfig: {},
      });

      expect(gqlQuery).toBeTruthy();
      expect(gqlQuery.loading).toBeDefined();
      expect(gqlQuery.execute).toBeDefined();
    });
  });

  it('should create a GQL query with variables', () => {
    const query = gql`
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const internals: InternalCreateGqlQueryCreatorOptions = {
      method: 'QUERY',
      transport: 'POST',
      client: client,
      query,
    };

    TestBed.runInInjectionContext(() => {
      const gqlQuery = createGqlQuery({
        creatorInternals: internals,
        features: [],
        queryConfig: {},
      });

      expect(gqlQuery).toBeTruthy();
    });
  });
});

describe('isCreateGqlQueryOptions', () => {
  it('should identify GQL query options correctly', () => {
    const client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    const gqlOptions = {
      creatorInternals: {
        method: 'QUERY' as const,
        transport: 'POST' as const,
        client: client,
        query: 'query { user { id } }',
      },
      features: [],
      queryConfig: {},
    };

    expect(isCreateGqlQueryOptions(gqlOptions)).toBe(true);
  });

  it('should return false for non-GQL query options', () => {
    const client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    const httpOptions = {
      creatorInternals: {
        method: 'GET' as const,
        route: '/users' as const,
        client: client,
      },
      features: [],
      queryConfig: {},
    };

    expect(isCreateGqlQueryOptions(httpOptions)).toBe(false);
  });
});
