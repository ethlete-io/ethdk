import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient } from '../http';
import { createGqlQueryCreator } from './gql-query-creator';
import { gql } from './gql-transformer';

describe('createGqlQueryCreator', () => {
  let client: ReturnType<typeof createQueryClient>;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create a query creator for GQL queries', () => {
    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    const creator = createGqlQueryCreator(undefined, {
      method: 'QUERY',
      transport: 'POST',
      client: client,
      query,
    });

    expect(creator).toBeTruthy();
    expect(typeof creator).toBe('function');
  });

  it('should create queries from the creator', () => {
    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    const creator = createGqlQueryCreator(undefined, {
      method: 'QUERY',
      transport: 'POST',
      client: client,
      query,
    });

    TestBed.runInInjectionContext(() => {
      const gqlQuery = creator();

      expect(gqlQuery).toBeTruthy();
      expect(gqlQuery.loading).toBeDefined();
    });
  });

  it('should create mutations from the creator', () => {
    const mutation = gql`
      mutation CreateUser($name: String!) {
        createUser(name: $name) {
          id
          name
        }
      }
    `;

    const creator = createGqlQueryCreator(undefined, {
      method: 'MUTATE',
      transport: 'POST',
      client: client,
      query: mutation,
    });

    TestBed.runInInjectionContext(() => {
      const gqlMutation = creator();

      expect(gqlMutation).toBeTruthy();
    });
  });

  it('should support GET transport', () => {
    const query = gql`
      query GetUser {
        user {
          id
        }
      }
    `;

    const creator = createGqlQueryCreator(undefined, {
      method: 'QUERY',
      transport: 'GET',
      client: client,
      query,
    });

    TestBed.runInInjectionContext(() => {
      const gqlQuery = creator();

      expect(gqlQuery).toBeTruthy();
    });
  });

  it('should accept query config', () => {
    const query = gql`
      query GetUser {
        user {
          id
        }
      }
    `;

    const creator = createGqlQueryCreator(undefined, {
      method: 'QUERY',
      transport: 'POST',
      client: client,
      query,
    });

    TestBed.runInInjectionContext(() => {
      const gqlQuery = creator({ key: 'custom-key' });

      expect(gqlQuery).toBeTruthy();
    });
  });
});
