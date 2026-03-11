import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createBearerAuthProvider } from '../auth';
import { createQueryClient } from '../http';
import { gql } from './gql-transformer';
import { createSecureGqlQuery } from './secure-gql-query';
import { InternalSecureCreateGqlQueryCreatorOptions } from './secure-gql-query-creator';

describe('createSecureGqlQuery', () => {
  let client: ReturnType<typeof createQueryClient>;
  let authProvider: ReturnType<typeof createBearerAuthProvider>;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });
    authProvider = createBearerAuthProvider({ queryClientRef: client, name: 'test', queries: [] });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create a secure GQL query', () => {
    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    const internals: InternalSecureCreateGqlQueryCreatorOptions = {
      method: 'QUERY',
      transport: 'POST',
      client,
      query,
      authProvider,
    };

    TestBed.runInInjectionContext(() => {
      const gqlQuery = createSecureGqlQuery({
        creatorInternals: internals,
        features: [],
        queryConfig: {},
      });

      expect(gqlQuery).toBeTruthy();
      expect(gqlQuery.loading).toBeDefined();
      expect(gqlQuery.execute).toBeDefined();
    });
  });

  it('should create a secure GQL query with variables', () => {
    const query = gql`
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const internals: InternalSecureCreateGqlQueryCreatorOptions = {
      method: 'QUERY',
      transport: 'POST',
      client,
      query,
      authProvider,
    };

    TestBed.runInInjectionContext(() => {
      const gqlQuery = createSecureGqlQuery({
        creatorInternals: internals,
        features: [],
        queryConfig: {},
      });

      expect(gqlQuery).toBeTruthy();
    });
  });

  it('should create a secure GQL mutation', () => {
    const mutation = gql`
      mutation CreateUser($name: String!) {
        createUser(name: $name) {
          id
        }
      }
    `;

    const internals: InternalSecureCreateGqlQueryCreatorOptions = {
      method: 'MUTATE',
      transport: 'POST',
      client,
      query: mutation,
      authProvider,
    };

    TestBed.runInInjectionContext(() => {
      const gqlMutation = createSecureGqlQuery({
        creatorInternals: internals,
        features: [],
        queryConfig: {},
      });

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

    const internals: InternalSecureCreateGqlQueryCreatorOptions = {
      method: 'QUERY',
      transport: 'GET',
      client,
      query,
      authProvider,
    };

    TestBed.runInInjectionContext(() => {
      const gqlQuery = createSecureGqlQuery({
        creatorInternals: internals,
        features: [],
        queryConfig: {},
      });

      expect(gqlQuery).toBeTruthy();
    });
  });
});
