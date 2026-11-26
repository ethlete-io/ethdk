import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createBearerAuthProvider } from '../auth';
import { createQueryClient } from '../http';
import {
  createSecureGqlMutationViaGet,
  createSecureGqlMutationViaPost,
  createSecureGqlQueryViaGet,
  createSecureGqlQueryViaPost,
} from './gql-query-creator-templates';
import { gql } from './gql-transformer';

describe('secure GQL query creator templates', () => {
  let client: ReturnType<typeof createQueryClient>;
  let authProvider: ReturnType<typeof createBearerAuthProvider>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });
    authProvider = createBearerAuthProvider({ queryClientRef: client, name: 'test', queries: [] });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  describe('createSecureGqlQueryViaGet', () => {
    it('should create a secure GQL query creator with GET transport', () => {
      TestBed.runInInjectionContext(() => {
        const query = gql`
          query GetUser {
            user {
              id
            }
          }
        `;

        const creator = createSecureGqlQueryViaGet(client, authProvider);
        const gqlQuery = creator(query);

        expect(gqlQuery).toBeTruthy();
      });
    });
  });

  describe('createSecureGqlQueryViaPost', () => {
    it('should create a secure GQL query creator with POST transport', () => {
      TestBed.runInInjectionContext(() => {
        const query = gql`
          query GetUser {
            user {
              id
            }
          }
        `;

        const creator = createSecureGqlQueryViaPost(client, authProvider);
        const gqlQuery = creator(query);

        expect(gqlQuery).toBeTruthy();
      });
    });
  });

  describe('createSecureGqlMutationViaGet', () => {
    it('should create a secure GQL mutation creator with GET transport', () => {
      TestBed.runInInjectionContext(() => {
        const mutation = gql`
          mutation CreateUser($name: String!) {
            createUser(name: $name) {
              id
            }
          }
        `;

        const creator = createSecureGqlMutationViaGet(client, authProvider);
        const gqlMutation = creator(mutation);

        expect(gqlMutation).toBeTruthy();
      });
    });
  });

  describe('createSecureGqlMutationViaPost', () => {
    it('should create a secure GQL mutation creator with POST transport', () => {
      TestBed.runInInjectionContext(() => {
        const mutation = gql`
          mutation CreateUser($name: String!) {
            createUser(name: $name) {
              id
            }
          }
        `;

        const creator = createSecureGqlMutationViaPost(client, authProvider);
        const gqlMutation = creator(mutation);

        expect(gqlMutation).toBeTruthy();
      });
    });
  });

  describe('with creator options', () => {
    it('should accept custom route', () => {
      TestBed.runInInjectionContext(() => {
        const query = gql`
          query GetUser {
            user {
              id
            }
          }
        `;

        const creator = createSecureGqlQueryViaPost(client, authProvider);
        const gqlQuery = creator(query, { route: '/custom-graphql' });

        expect(gqlQuery).toBeTruthy();
      });
    });

    it('should accept custom transformResponse', () => {
      TestBed.runInInjectionContext(() => {
        const query = gql`
          query GetUser {
            user {
              id
              name
            }
          }
        `;

        const creator = createSecureGqlQueryViaPost(client, authProvider);
        const gqlQuery = creator<{ response: number; rawResponse: { data: { user: { id: number } } } }>(query, {
          transformResponse: (raw) => raw.data.user.id,
        });

        expect(gqlQuery).toBeTruthy();
      });
    });
  });

  it('uses the transport verb independently from the operation kind', () => {
    const auth = TestBed.runInInjectionContext(() => authProvider.inject());
    auth.setTokens('access', 'refresh');

    TestBed.runInInjectionContext(() => {
      createSecureGqlQueryViaPost(
        client,
        authProvider,
      )(gql`
        query GetUser {
          user {
            id
          }
        }
      `)();

      const mutation = createSecureGqlMutationViaGet(
        client,
        authProvider,
      )(gql`
        mutation DeleteUser {
          deleteUser
        }
      `)();
      mutation.execute();
    });
    TestBed.tick();

    const post = httpTesting.expectOne('https://api.example.com');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(expect.objectContaining({ operationName: 'GetUser' }));
    post.flush({ data: { user: { id: 1 } } });

    const get = httpTesting.expectOne((request) => request.method === 'GET');
    expect(get.request.method).toBe('GET');
    expect(get.request.urlWithParams).toContain('operationName=DeleteUser');
    get.flush({ data: { deleteUser: true } });
  });
});
