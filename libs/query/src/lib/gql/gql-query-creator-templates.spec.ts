import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient } from '../http';
import {
  createGqlMutationViaGet,
  createGqlMutationViaPost,
  createGqlQueryViaGet,
  createGqlQueryViaPost,
} from './gql-query-creator-templates';
import { gql } from './gql-transformer';

describe('gql query creator templates', () => {
  let client: ReturnType<typeof createQueryClient>;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  describe('createGqlQueryViaGet', () => {
    it('should create a query creator with GET transport', () => {
      const query = gql`
        query GetUser {
          user {
            id
            name
          }
        }
      `;
      const createQuery = createGqlQueryViaGet(client);
      const creator = createQuery(query);

      expect(creator).toBeTruthy();
      expect(typeof creator).toBe('function');
    });

    it('should create queries that use GET transport', () => {
      const query = gql`
        query GetUser {
          user {
            id
          }
        }
      `;
      const createQuery = createGqlQueryViaGet(client);
      const creator = createQuery(query);

      TestBed.runInInjectionContext(() => {
        const gqlQuery = creator();

        expect(gqlQuery).toBeTruthy();
        expect(gqlQuery.loading).toBeDefined();
      });
    });
  });

  describe('createGqlQueryViaPost', () => {
    it('should create a query creator with POST transport', () => {
      const query = gql`
        query GetUser {
          user {
            id
            name
          }
        }
      `;
      const createQuery = createGqlQueryViaPost(client);
      const creator = createQuery(query);

      expect(creator).toBeTruthy();
      expect(typeof creator).toBe('function');
    });

    it('should create queries that use POST transport', () => {
      const query = gql`
        query GetUser {
          user {
            id
          }
        }
      `;
      const createQuery = createGqlQueryViaPost(client);
      const creator = createQuery(query);

      TestBed.runInInjectionContext(() => {
        const gqlQuery = creator();

        expect(gqlQuery).toBeTruthy();
        expect(gqlQuery.loading).toBeDefined();
      });
    });
  });

  describe('createGqlMutationViaGet', () => {
    it('should create a mutation creator with GET transport', () => {
      const mutation = gql`
        mutation CreateUser($name: String!) {
          createUser(name: $name) {
            id
          }
        }
      `;
      const createMutation = createGqlMutationViaGet(client);
      const creator = createMutation(mutation);

      expect(creator).toBeTruthy();
      expect(typeof creator).toBe('function');
    });

    it('should create mutations that use GET transport', () => {
      const mutation = gql`
        mutation UpdateUser($id: ID!) {
          updateUser(id: $id) {
            id
          }
        }
      `;
      const createMutation = createGqlMutationViaGet(client);
      const creator = createMutation(mutation);

      TestBed.runInInjectionContext(() => {
        const gqlMutation = creator();

        expect(gqlMutation).toBeTruthy();
        expect(gqlMutation.loading).toBeDefined();
      });
    });
  });

  describe('createGqlMutationViaPost', () => {
    it('should create a mutation creator with POST transport', () => {
      const mutation = gql`
        mutation CreateUser($name: String!) {
          createUser(name: $name) {
            id
          }
        }
      `;
      const createMutation = createGqlMutationViaPost(client);
      const creator = createMutation(mutation);

      expect(creator).toBeTruthy();
      expect(typeof creator).toBe('function');
    });

    it('should create mutations that use POST transport', () => {
      const mutation = gql`
        mutation DeleteUser($id: ID!) {
          deleteUser(id: $id) {
            success
          }
        }
      `;
      const createMutation = createGqlMutationViaPost(client);
      const creator = createMutation(mutation);

      TestBed.runInInjectionContext(() => {
        const gqlMutation = creator();

        expect(gqlMutation).toBeTruthy();
        expect(gqlMutation.loading).toBeDefined();
      });
    });
  });

  describe('creator options', () => {
    it('should accept creator options for queries', () => {
      const query = gql`
        query GetUser {
          user {
            id
          }
        }
      `;
      const createQuery = createGqlQueryViaPost(client);
      const creator = createQuery(query, { responseType: 'json' });

      expect(creator).toBeTruthy();
    });

    it('should accept creator options for mutations', () => {
      const mutation = gql`
        mutation CreateUser {
          createUser {
            id
          }
        }
      `;
      const createMutation = createGqlMutationViaPost(client);
      const creator = createMutation(mutation, { reportProgress: true });

      expect(creator).toBeTruthy();
    });
  });
});
