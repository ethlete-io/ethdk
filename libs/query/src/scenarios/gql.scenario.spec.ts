import { signal } from '@angular/core';
import {
  createGqlMutationViaGet,
  createGqlMutationViaPost,
  createGqlQueryViaGet,
  createGqlQueryViaPost,
  createSecureGqlMutationViaGet,
  createSecureGqlQueryViaPost,
  gql,
  withArgs,
} from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

type UserResponse = { user: { id: string; name: string } };
type UserVariables = { userId: string };

const getUserDoc = gql`
  query GetUser($userId: ID!) {
    user(id: $userId) {
      id
      name
    }
  }
`;

describe('gql scenario', () => {
  describe('GET transport', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends the document and variables in the URL query string with verb GET', () => {
      const s = scenario();
      s.api.on('GET', '/', () => ({ body: { data: { user: { id: '1', name: 'Ada' } } } }));

      const getUser = createGqlQueryViaGet(s.clientRef)<{ response: UserResponse; variables: UserVariables }>(
        getUserDoc,
      );

      const c = s.consumer();
      const query = c.run(() => getUser(withArgs(() => ({ variables: { userId: '1' } }))));
      s.tick();

      expect(s.api.requests).toHaveLength(1);
      const req = s.api.requests[0];
      if (!req) throw new Error('expected a request');

      expect(req.method).toBe('GET');
      expect(req.body).toBeNull();
      expect(req.query['query']).toContain('query GetUser');
      expect(req.query['operationName']).toBe('GetUser');
      expect(JSON.parse(req.query['variables'] ?? '')).toEqual({ userId: '1' });
      expect(query.response()).toEqual({ user: { id: '1', name: 'Ada' } });

      c.destroy();
    });
  });

  describe('POST transport', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends the document and variables in the JSON body with verb POST', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: '2', name: 'Grace' } } } }));

      const getUser = createGqlQueryViaPost(s.clientRef)<{ response: UserResponse; variables: UserVariables }>(
        getUserDoc,
      );

      const c = s.consumer();
      const query = c.run(() => getUser(withArgs(() => ({ variables: { userId: '2' } }))));
      s.tick();

      expect(s.api.requests).toHaveLength(1);
      const req = s.api.requests[0];
      if (!req) throw new Error('expected a request');

      expect(req.method).toBe('POST');
      expect(Object.keys(req.query)).toHaveLength(0);
      const body = req.body as { query: string; variables: string; operationName: string };
      expect(body.query).toContain('query GetUser');
      expect(body.operationName).toBe('GetUser');
      expect(JSON.parse(body.variables)).toEqual({ userId: '2' });
      expect(query.response()).toEqual({ user: { id: '2', name: 'Grace' } });

      c.destroy();
    });
  });

  describe('mutations', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('a mutation via POST sends the document and variables in the body with verb POST', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { renameUser: { ok: true } } } }));

      const renameUser = createGqlMutationViaPost(s.clientRef)<{
        response: { renameUser: { ok: boolean } };
        variables: { name: string };
      }>(gql`
        mutation RenameUser($name: String!) {
          renameUser(name: $name) {
            ok
          }
        }
      `);

      const c = s.consumer();
      const mutation = c.run(() => renameUser());
      mutation.execute({ args: { variables: { name: 'Ada' } } });
      s.tick();

      expect(s.api.requests).toHaveLength(1);
      const req = s.api.requests[0];
      if (!req) throw new Error('expected a request');

      expect(req.method).toBe('POST');
      const body = req.body as { query: string; variables: string; operationName: string };
      expect(body.operationName).toBe('RenameUser');
      expect(JSON.parse(body.variables)).toEqual({ name: 'Ada' });
      expect(mutation.response()).toEqual({ renameUser: { ok: true } });

      c.destroy();
    });

    it('a mutation via GET sends the document and variables in the URL query string with verb GET', () => {
      const s = scenario();
      s.api.on('GET', '/', () => ({ body: { data: { deleteUser: true } } }));

      const deleteUser = createGqlMutationViaGet(s.clientRef)<{
        response: { deleteUser: boolean };
        variables: { id: string };
      }>(gql`
        mutation DeleteUser($id: ID!) {
          deleteUser(id: $id)
        }
      `);

      const c = s.consumer();
      const mutation = c.run(() => deleteUser());
      mutation.execute({ args: { variables: { id: '9' } } });
      s.tick();

      expect(s.api.requests).toHaveLength(1);
      const req = s.api.requests[0];
      if (!req) throw new Error('expected a request');

      expect(req.method).toBe('GET');
      expect(req.body).toBeNull();
      expect(req.query['operationName']).toBe('DeleteUser');
      expect(JSON.parse(req.query['variables'] ?? '')).toEqual({ id: '9' });

      c.destroy();
    });
  });

  describe('response envelope', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('unwraps the { data } envelope into response()', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: '1', name: 'Ada' } } } }));

      const getUser = createGqlQueryViaPost(s.clientRef)<{ response: UserResponse }>(getUserDoc);

      const c = s.consumer();
      const query = c.run(() => getUser());
      s.tick();

      expect(query.response()).toEqual({ user: { id: '1', name: 'Ada' } });

      c.destroy();
    });

    it('a 200 response with no data property (e.g. a GraphQL errors payload) throws on read instead of silently unwrapping', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { errors: [{ message: 'boom' }] } }));

      const getUser = createGqlQueryViaPost(s.clientRef)<{ response: unknown }>(getUserDoc);

      const c = s.consumer();
      const query = c.run(() => getUser());
      s.tick();

      expect(() => query.response()).toThrow(/missing the required "data" property/);

      c.destroy();
    });
  });

  describe('secure gql creators', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('createSecureGqlQueryViaPost sends the documented verb (POST) with the bearer header', () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/');
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: 'me', name: 'Ada' } } } }));

      const getSecureUser = createSecureGqlQueryViaPost(
        s.clientRef,
        auth.ref,
      )<{ response: UserResponse; variables: UserVariables }>(getUserDoc);

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();

      const query = c.run(() => getSecureUser(withArgs(() => ({ variables: { userId: 'me' } }))));
      s.tick();

      const gqlRequest = s.api.requests.find((r) => r.method === 'POST' && r.path === '/');
      if (!gqlRequest) throw new Error('expected the gql request');

      expect(gqlRequest.headers.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);
      expect(query.response()).toEqual({ user: { id: 'me', name: 'Ada' } });

      c.destroy();
    });

    it('createSecureGqlMutationViaGet sends the documented verb (GET) with the bearer header', () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/');
      s.api.on('GET', '/', () => ({ body: { data: { deleteUser: true } } }));

      const deleteUser = createSecureGqlMutationViaGet(
        s.clientRef,
        auth.ref,
      )<{ response: { deleteUser: boolean }; variables: { id: string } }>(gql`
        mutation DeleteUser($id: ID!) {
          deleteUser(id: $id)
        }
      `);

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();

      const mutation = c.run(() => deleteUser());
      mutation.execute({ args: { variables: { id: '9' } } });
      s.tick();

      const gqlRequest = s.api.requests.find((r) => r.method === 'GET' && r.path === '/');
      if (!gqlRequest) throw new Error('expected the gql request');

      expect(gqlRequest.headers.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);
      expect(JSON.parse(gqlRequest.query['variables'] ?? '')).toEqual({ id: '9' });

      c.destroy();
    });
  });

  describe('args stay isolated across executions', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('re-executing a POST-transport query with new withArgs variables sends only the latest variables', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: '1', name: 'first' } } } }));

      const variables = signal<UserVariables>({ userId: '1' });
      const getUser = createGqlQueryViaPost(s.clientRef)<{ response: UserResponse; variables: UserVariables }>(
        getUserDoc,
      );

      const c = s.consumer();
      c.run(() => getUser(withArgs(() => ({ variables: variables() }))));
      s.tick();

      variables.set({ userId: '2' });
      s.tick();

      expect(s.api.requests).toHaveLength(2);
      const [first, second] = s.api.requests;
      if (!first || !second) throw new Error('expected two requests');

      expect(JSON.parse((first.body as { variables: string }).variables)).toEqual({ userId: '1' });
      expect(JSON.parse((second.body as { variables: string }).variables)).toEqual({ userId: '2' });

      c.destroy();
    });
  });

  describe('operationName extraction', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('derives the operation name for a document without a parenthesized variable list', () => {
      const s = scenario();
      s.api.on('GET', '/', () => ({ body: { data: { user: { id: '1', name: 'Ada' } } } }));

      const getUser = createGqlQueryViaGet(s.clientRef)<{ response: UserResponse }>(gql`
        query GetUser {
          user(id: "1") {
            id
            name
          }
        }
      `);

      const c = s.consumer();
      c.run(() => getUser());
      s.tick();

      const req = s.api.requests[0];
      if (!req) throw new Error('expected a request');
      expect(req.query['operationName']).toBe('GetUser');

      c.destroy();
    });

    it('derives the operation name across a multi-line variable list', () => {
      const s = scenario();
      s.api.on('GET', '/', () => ({ body: { data: { user: { id: '1', name: 'Ada' } } } }));

      const getUser = createGqlQueryViaGet(s.clientRef)<{ response: UserResponse; variables: UserVariables }>(gql`
        query GetUser($userId: ID!, $withName: Boolean = true) {
          user(id: $userId) {
            id
            name @include(if: $withName)
          }
        }
      `);

      const c = s.consumer();
      c.run(() => getUser(withArgs(() => ({ variables: { userId: '1' } }))));
      s.tick();

      const req = s.api.requests[0];
      if (!req) throw new Error('expected a request');
      expect(req.query['operationName']).toBe('GetUser');

      c.destroy();
    });
  });

  describe('secure gql caching follows the operation kind, not the transport', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('two consumers of a secure query via POST with the same variables share one request', () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/');
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: 'me', name: 'Ada' } } } }));

      const getSecureUser = createSecureGqlQueryViaPost(
        s.clientRef,
        auth.ref,
      )<{ response: UserResponse; variables: UserVariables }>(getUserDoc);

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();

      const a = s.consumer();
      const b = s.consumer();
      const q1 = a.run(() => getSecureUser(withArgs(() => ({ variables: { userId: 'me' } }))));
      const q2 = b.run(() => getSecureUser(withArgs(() => ({ variables: { userId: 'me' } }))));
      s.tick();

      expect(s.api.requestCount('POST', '/')).toBe(1);
      expect(q1.response()).toEqual({ user: { id: 'me', name: 'Ada' } });
      expect(q2.response()).toEqual(q1.response());

      a.destroy();
      b.destroy();
      c.destroy();
    });

    it('a secure mutation via GET is not re-run by refreshQueriesInUse', () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/');
      s.api.on('GET', '/', () => ({ body: { data: { deleteUser: true } } }));

      const deleteUser = createSecureGqlMutationViaGet(
        s.clientRef,
        auth.ref,
      )<{ response: { deleteUser: boolean }; variables: { id: string } }>(gql`
        mutation DeleteUser($id: ID!) {
          deleteUser(id: $id)
        }
      `);

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();

      const mutation = c.run(() => deleteUser());
      mutation.execute({ args: { variables: { id: '9' } } });
      s.tick();

      expect(s.api.requestCount('GET', '/')).toBe(1);

      s.client.refreshQueriesInUse();
      s.tick();

      expect(s.api.requestCount('GET', '/')).toBe(1);

      c.destroy();
    });
  });
});
