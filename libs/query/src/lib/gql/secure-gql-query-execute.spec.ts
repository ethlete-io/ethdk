import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createBearerAuthProvider } from '../auth';
import { createQueryClient, setupQueryDependencies } from '../http';
import { setupQueryState } from '../http/query-state';
import { GqlQueryArgs } from './gql-query';
import { gql } from './gql-transformer';
import { createSecureGqlExecuteFn } from './secure-gql-query-execute';

describe('createSecureGqlExecuteFn', () => {
  let client: ReturnType<typeof createQueryClient>;
  let authProvider: ReturnType<typeof createBearerAuthProvider>;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });
    authProvider = createBearerAuthProvider({ queryClientRef: client, name: 'test', queries: [] });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create a secure execute function for GQL queries', () => {
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

      const execute = createSecureGqlExecuteFn<GqlQueryArgs>({
        deps,
        state,
        creatorInternals: {
          method: 'QUERY',
          transport: 'POST',
          client,
          query,
          authProvider,
        },
        queryConfig: {},
      });

      expect(execute).toBeTruthy();
      expect(typeof execute).toBe('function');
      expect(execute.reset).toBeDefined();
      expect(execute.currentRepositoryKey).toBeDefined();
    });
  });

  it('should create a secure execute function for GQL mutations', () => {
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

      const execute = createSecureGqlExecuteFn<GqlQueryArgs>({
        deps,
        state,
        creatorInternals: {
          method: 'MUTATE',
          transport: 'POST',
          client,
          query: mutation,
          authProvider,
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

      const execute = createSecureGqlExecuteFn<GqlQueryArgs>({
        deps,
        state,
        creatorInternals: {
          method: 'QUERY',
          transport: 'GET',
          client,
          query,
          authProvider,
        },
        queryConfig: {},
      });

      expect(execute).toBeTruthy();
    });
  });
});
