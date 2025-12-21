import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient, setupQueryDependencies } from '../http';
import { setupQueryState } from '../http/query-state';
import { GqlQueryArgs } from './gql-query';
import { createGqlExecuteFn } from './gql-query-execute';
import { gql } from './gql-transformer';

describe('createGqlExecuteFn', () => {
  let client: ReturnType<typeof createQueryClient>;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create an execute function for GQL queries', () => {
    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    TestBed.runInInjectionContext(() => {
      const deps = setupQueryDependencies({ client, queryConfig: {} });
      const state = setupQueryState<GqlQueryArgs>({});

      const execute = createGqlExecuteFn<GqlQueryArgs>({
        deps,
        state,
        creatorInternals: {
          method: 'QUERY',
          transport: 'POST',
          client: client,
          query,
        },
        queryConfig: {},
      });

      expect(execute).toBeTruthy();
      expect(typeof execute).toBe('function');
      expect(execute.reset).toBeDefined();
      expect(execute.currentRepositoryKey).toBeDefined();
    });
  });

  it('should create an execute function for mutations', () => {
    const mutation = gql`
      mutation CreateUser($name: String!) {
        createUser(name: $name) {
          id
        }
      }
    `;

    TestBed.runInInjectionContext(() => {
      const deps = setupQueryDependencies({ client, queryConfig: {} });
      const state = setupQueryState<GqlQueryArgs>({});

      const execute = createGqlExecuteFn<GqlQueryArgs>({
        deps,
        state,
        creatorInternals: {
          method: 'MUTATE',
          transport: 'POST',
          client: client,
          query: mutation,
        },
        queryConfig: {},
      });

      expect(execute).toBeTruthy();
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

    TestBed.runInInjectionContext(() => {
      const deps = setupQueryDependencies({ client, queryConfig: {} });
      const state = setupQueryState<GqlQueryArgs>({});

      const execute = createGqlExecuteFn<GqlQueryArgs>({
        deps,
        state,
        creatorInternals: {
          method: 'QUERY',
          transport: 'GET',
          client: client,
          query,
        },
        queryConfig: {},
      });

      expect(execute).toBeTruthy();
    });
  });
});
