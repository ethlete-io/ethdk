import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createBearerAuthProvider } from '../auth';
import { createQueryClient } from '../http';
import { gql } from './gql-transformer';
import { createSecureGqlQueryCreator } from './secure-gql-query-creator';

describe('createSecureGqlQueryCreator', () => {
  let client: ReturnType<typeof createQueryClient>;
  let authProvider: ReturnType<typeof createBearerAuthProvider>;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });
    authProvider = createBearerAuthProvider({ queryClientRef: client, name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create a secure query creator for GQL queries', () => {
    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    const creator = createSecureGqlQueryCreator(undefined, {
      method: 'QUERY',
      transport: 'POST',
      client: client,
      query,
      authProvider,
    });

    expect(creator).toBeTruthy();
    expect(typeof creator).toBe('function');
  });

  it('should create queries from the secure creator', () => {
    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    const creator = createSecureGqlQueryCreator(undefined, {
      method: 'QUERY',
      transport: 'POST',
      client: client,
      query,
      authProvider,
    });

    TestBed.runInInjectionContext(() => {
      const gqlQuery = creator();

      expect(gqlQuery).toBeTruthy();
      expect(gqlQuery.loading).toBeDefined();
    });
  });

  it('should create mutations from the secure creator', () => {
    const mutation = gql`
      mutation CreateUser($name: String!) {
        createUser(name: $name) {
          id
          name
        }
      }
    `;

    const creator = createSecureGqlQueryCreator(undefined, {
      method: 'MUTATE',
      transport: 'POST',
      client: client,
      query: mutation,
      authProvider,
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

    const creator = createSecureGqlQueryCreator(undefined, {
      method: 'QUERY',
      transport: 'GET',
      client: client,
      query,
      authProvider,
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

    const creator = createSecureGqlQueryCreator(undefined, {
      method: 'QUERY',
      transport: 'POST',
      client: client,
      query,
      authProvider,
    });

    TestBed.runInInjectionContext(() => {
      const gqlQuery = creator({ key: 'custom-key' });

      expect(gqlQuery).toBeTruthy();
    });
  });

  it('should have optional transformResponse even when rawResponse differs from response', () => {
    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    // GQL queries should always allow omitting transformResponse
    // because the default unwrapping is auto-provided
    const creator = createSecureGqlQueryCreator<{
      response: { id: number; name: string };
      rawResponse: { data: { id: number; name: string } };
    }>(undefined, {
      method: 'QUERY',
      transport: 'POST',
      client: client,
      query,
      authProvider,
    });

    expect(creator).toBeTruthy();
  });

  it('should allow custom transformResponse to override default', () => {
    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    const creator = createSecureGqlQueryCreator<{
      response: number;
      rawResponse: { data: { user: { id: number; name: string } } };
    }>(
      {
        transformResponse: (raw) => raw.data.user.id,
      },
      {
        method: 'QUERY',
        transport: 'POST',
        client: client,
        query,
        authProvider,
      },
    );

    expect(creator).toBeTruthy();
  });
});
