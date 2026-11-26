import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient } from '../http';
import { CreateGqlQueryCreatorOptions, createGqlQueryCreator } from './gql-query-creator';
import { GqlQueryArgs } from './gql-query';
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

  describe('GQL transformResponse behavior', () => {
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
      const creator = createGqlQueryCreator<{
        response: { id: number; name: string };
        rawResponse: { data: { id: number; name: string } };
      }>(undefined, {
        method: 'QUERY',
        transport: 'POST',
        client: client,
        query,
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

      const creator = createGqlQueryCreator<{
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
        },
      );

      expect(creator).toBeTruthy();
    });

    it('should auto-unwrap { data: ... } when transformResponse not provided', () => {
      const query = gql`
        query GetUser {
          user {
            id
          }
        }
      `;

      const creator = createGqlQueryCreator<{
        response: { id: number };
      }>(undefined, {
        method: 'QUERY',
        transport: 'POST',
        client: client,
        query,
      });

      expect(creator).toBeTruthy();
    });
  });

  describe('rawResponse envelope typing', () => {
    type User = { id: number; name: string };

    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    it('should type transformResponse against { data: TResponse } when rawResponse is not declared', () => {
      expectTypeOf<NonNullable<CreateGqlQueryCreatorOptions<{ response: User }>['transformResponse']>>()
        .parameter(0)
        .toEqualTypeOf<{ data: User }>();
    });

    it('should allow declaring an envelope other than { data }', () => {
      type Args = { response: User; rawResponse: { payload: User } };

      expectTypeOf<Args>().toExtend<GqlQueryArgs>();
      expectTypeOf<NonNullable<CreateGqlQueryCreatorOptions<Args>['transformResponse']>>()
        .parameter(0)
        .toEqualTypeOf<{ payload: User }>();

      const creator = createGqlQueryCreator<Args>(
        { transformResponse: (raw) => raw.payload },
        { method: 'QUERY', transport: 'POST', client, query },
      );

      expect(creator).toBeTruthy();
    });
  });
});
