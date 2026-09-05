import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import {
  createGqlMutationViaGet,
  createGqlMutationViaPost,
  createGqlQueryViaGet,
  createGqlQueryViaPost,
  createSecureGqlMutationViaGet,
  createSecureGqlMutationViaPost,
  createSecureGqlQueryViaGet,
  createSecureGqlQueryViaPost,
  gql,
  withArgs,
  withPolling,
} from '../index';
import { describe, expect, it } from 'vitest';
import { inProductionMode, useScenario } from './harness';

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

const commentedDoc = gql`
  # the signed in user
  query Me {
    me {
      id
    }
  }
`;

const is401 = (entry: { error: unknown }) => entry.error instanceof HttpErrorResponse && entry.error.status === 401;

/**
 * Counts how often the gql document is parsed for its operation name. `getOpName` is the only
 * regex in the library whose source names both operation kinds, so a call through it is one
 * document preparation.
 */
const countingDocumentParses = <T>(fn: () => T): { result: T; parses: number } => {
  const originalExec = RegExp.prototype.exec;
  let parses = 0;

  RegExp.prototype.exec = function (this: RegExp, input: string) {
    if (this.source.includes('(?:query|mutation)')) {
      parses++;
    }

    return originalExec.call(this, input);
  };

  try {
    return { result: fn(), parses };
  } finally {
    RegExp.prototype.exec = originalExec;
  }
};

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
      expect(req.query['variables']).toBe(JSON.stringify({ userId: '1' }));
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
      const body = req.body as { query: string; variables: unknown; operationName: string };
      expect(body.query).toContain('query GetUser');
      expect(body.operationName).toBe('GetUser');
      expect(body.variables).toEqual({ userId: '2' });
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
      const body = req.body as { query: string; variables: unknown; operationName: string };
      expect(body.operationName).toBe('RenameUser');
      expect(body.variables).toEqual({ name: 'Ada' });
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

    it('a 200 response with no data property (e.g. a GraphQL errors payload) is a failure instead of a silent unwrap', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { errors: [{ message: 'boom' }] } }));

      const getUser = createGqlQueryViaPost(s.clientRef)<{ response: unknown }>(getUserDoc);

      const c = s.consumer();
      const query = c.run(() => getUser());
      s.tick();

      expect(query.response()).toBeNull();
      expect(query.error()?.code).toBe(0);
      expect(String(query.error()?.raw.error)).toMatch(/missing the required "data" property/);
      expect(query.executionState()).toMatchObject({ type: 'failure', hasCachedResponse: false });

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

      expect((first.body as { variables: unknown }).variables).toEqual({ userId: '1' });
      expect((second.body as { variables: unknown }).variables).toEqual({ userId: '2' });

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

  describe('document serialization', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends the pretty-printed document in dev mode', () => {
      const s = scenario();
      s.api.on('GET', '/', () => ({ body: { data: { me: { id: '1' } } } }));

      const me = createGqlQueryViaGet(s.clientRef)<{ response: { me: { id: string } } }>(commentedDoc);

      const c = s.consumer();
      c.run(() => me());
      s.tick();

      const document = s.api.requests[0]?.query['query'];
      expect(document).toContain('# the signed in user');
      expect(document).toContain('\n');

      c.destroy();
    });

    it('drops the comments and collapses the whitespace of the document in a production build', () => {
      const s = scenario();
      s.api.on('GET', '/', () => ({ body: { data: { me: { id: '1' } } } }));

      const c = s.consumer();

      inProductionMode(() => {
        const me = createGqlQueryViaGet(s.clientRef)<{ response: { me: { id: string } } }>(commentedDoc);
        c.run(() => me());
        s.tick();
      });

      expect(s.api.requests[0]?.query['query']).toBe('query Me { me { id } }');

      c.destroy();
    });
  });

  describe('secure gql transports', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('createSecureGqlQueryViaGet sends the documented verb (GET) with the bearer header', () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/');
      s.api.on('GET', '/', () => ({ body: { data: { user: { id: 'me', name: 'Ada' } } } }));

      const getSecureUser = createSecureGqlQueryViaGet(
        s.clientRef,
        auth.ref,
      )<{ response: UserResponse; variables: UserVariables }>(getUserDoc);

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();

      const query = c.run(() => getSecureUser(withArgs(() => ({ variables: { userId: 'me' } }))));
      s.tick();

      const request = s.api.requests.find((r) => r.method === 'GET' && r.path === '/');
      if (!request) throw new Error('expected the gql request');

      expect(request.headers.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);
      expect(request.body).toBeNull();
      expect(request.query['operationName']).toBe('GetUser');
      expect(JSON.parse(request.query['variables'] ?? '')).toEqual({ userId: 'me' });
      expect(query.response()).toEqual({ user: { id: 'me', name: 'Ada' } });

      c.destroy();
    });

    it('createSecureGqlMutationViaPost sends the documented verb (POST) with the bearer header', () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/');
      s.api.on('POST', '/', () => ({ body: { data: { renameUser: { ok: true } } } }));

      const renameUser = createSecureGqlMutationViaPost(
        s.clientRef,
        auth.ref,
      )<{
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
      c.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();

      const mutation = c.run(() => renameUser());
      mutation.execute({ args: { variables: { name: 'Ada' } } });
      s.tick();

      const request = s.api.requests.find((r) => r.method === 'POST' && r.path === '/');
      if (!request) throw new Error('expected the gql request');

      expect(request.headers.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);
      expect((request.body as { operationName: string }).operationName).toBe('RenameUser');
      expect((request.body as { variables: unknown }).variables).toEqual({ name: 'Ada' });
      expect(mutation.response()).toEqual({ renameUser: { ok: true } });

      c.destroy();
    });
  });

  describe('caching follows the operation kind', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('shares one request for identical variables via POST and fires a second one for different variables', () => {
      const s = scenario();
      s.api.on('POST', '/', ({ body }) => {
        const variables = (body as { variables: UserVariables }).variables;

        return { body: { data: { user: { id: variables.userId, name: `user ${variables.userId}` } } } };
      });

      const getUser = createGqlQueryViaPost(s.clientRef)<{ response: UserResponse; variables: UserVariables }>(
        getUserDoc,
      );

      const a = s.consumer();
      const b = s.consumer();
      const q1 = a.run(() => getUser(withArgs(() => ({ variables: { userId: '1' } }))));
      const q2 = b.run(() => getUser(withArgs(() => ({ variables: { userId: '1' } }))));
      s.tick();

      expect(s.api.requestCount('POST', '/')).toBe(1);
      expect(q1.response()).toEqual({ user: { id: '1', name: 'user 1' } });
      expect(q2.response()).toEqual(q1.response());

      const d = s.consumer();
      const q3 = d.run(() => getUser(withArgs(() => ({ variables: { userId: '2' } }))));
      s.tick();

      expect(s.api.requestCount('POST', '/')).toBe(2);
      expect(q3.response()).toEqual({ user: { id: '2', name: 'user 2' } });

      a.destroy();
      b.destroy();
      d.destroy();
    });

    it('never dedupes a gql mutation, even with identical variables', () => {
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
      mutation.execute({ args: { variables: { name: 'Ada' } } });
      s.tick();

      const other = s.consumer();
      const otherMutation = other.run(() => renameUser());
      otherMutation.execute({ args: { variables: { name: 'Ada' } } });
      s.tick();

      expect(s.api.requestCount('POST', '/')).toBe(3);

      c.destroy();
      other.destroy();
    });
  });

  describe('secure gql token gating', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('holds a secure gql query until a valid access token exists', () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/');
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: 'me', name: 'Ada' } } } }));

      const getSecureUser = createSecureGqlQueryViaPost(
        s.clientRef,
        auth.ref,
      )<{ response: UserResponse; variables: UserVariables }>(getUserDoc);

      const c = s.consumer();
      const query = c.run(() => getSecureUser(withArgs(() => ({ variables: { userId: 'me' } }))));
      s.tick();

      expect(s.api.requestCount('POST', '/')).toBe(0);
      expect(query.response()).toBeNull();
      expect(query.error()).toBeNull();

      c.run(() => auth.queries.login.execute({ body: {} }));
      s.flush();

      expect(s.api.requestCount('POST', '/')).toBe(1);
      expect(s.api.requests.find((r) => r.path === '/')?.headers.get('Authorization')).toBe(
        `Bearer ${auth.accessToken()}`,
      );
      expect(query.response()).toEqual({ user: { id: 'me', name: 'Ada' } });

      c.destroy();
    });

    it('refreshes once and retries a secure gql query that answered 401', async () => {
      const s = scenario();
      const auth = s.auth({ autoRetryOn401: true });

      s.api.protect('/');
      s.api.once('POST', '/', () => ({ status: 401, body: { message: 'revoked' } }));
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: 'me', name: 'Ada' } } } }));

      const getSecureUser = createSecureGqlQueryViaPost(
        s.clientRef,
        auth.ref,
      )<{ response: UserResponse; variables: UserVariables }>(getUserDoc);

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();

      const tokenAtLogin = auth.accessToken();
      const query = c.run(() => getSecureUser(withArgs(() => ({ variables: { userId: 'me' } }))));
      s.flush();
      await s.settle();
      s.flush();
      await s.settle();

      expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
      expect(auth.accessToken()).not.toBe(tokenAtLogin);
      expect(s.api.requestCount('POST', '/')).toBe(2);
      expect(query.response()).toEqual({ user: { id: 'me', name: 'Ada' } });

      const retried = s.api.requests.filter((r) => r.path === '/')[1];
      expect(retried?.headers.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);

      s.expectError(is401);
      c.destroy();
    });
  });

  describe('variables and response typing', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends the variables handed to execute() rather than a withArgs feature', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: '7', name: 'Ada' } } } }));

      const getUser = createGqlQueryViaPost(s.clientRef)<{ response: UserResponse; variables: UserVariables }>(
        getUserDoc,
      );

      const c = s.consumer();
      const query = c.run(() => getUser({ onlyManualExecution: true }));
      s.tick();

      expect(s.api.requests).toHaveLength(0);

      query.execute({ args: { variables: { userId: '7' } } });
      s.tick();

      expect(s.api.requestCount('POST', '/')).toBe(1);
      expect((s.api.requests[0]?.body as { variables: unknown }).variables).toEqual({ userId: '7' });
      expect(query.response()).toEqual({ user: { id: '7', name: 'Ada' } });

      c.destroy();
    });

    it('unwraps an envelope other than { data } through a custom transformResponse', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { payload: { user: { id: '3', name: 'Grace' } } } }));

      const getUser = createGqlQueryViaPost(s.clientRef)<{
        response: UserResponse;
        rawResponse: { payload: UserResponse };
      }>(getUserDoc, { transformResponse: (raw) => raw.payload });

      const c = s.consumer();
      const query = c.run(() => getUser());
      s.tick();

      expect(query.response()).toEqual({ user: { id: '3', name: 'Grace' } });
      expect(query.error()).toBeNull();

      c.destroy();
    });

    it('lets a custom transformResponse replace the default { data } unwrapping', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: '4', name: 'Ada' } } } }));

      const getUserName = createGqlQueryViaPost(s.clientRef)<{
        response: string;
        rawResponse: { data: UserResponse };
      }>(getUserDoc, { transformResponse: (raw) => raw.data.user.name });

      const c = s.consumer();
      const query = c.run(() => getUserName());
      s.tick();

      expect(query.response()).toBe('Ada');

      c.destroy();
    });

    it('fails a data-less 200 with ET600 outside dev mode too', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { errors: [{ message: 'boom' }] } }));

      const c = s.consumer();

      const query = inProductionMode(() => {
        const getUser = createGqlQueryViaPost(s.clientRef)<{ response: unknown }>(getUserDoc);
        const created = c.run(() => getUser());
        s.tick();

        return created;
      });

      expect(query.response()).toBeNull();
      expect(query.error()?.code).toBe(0);
      expect(String(query.error()?.raw.error)).toContain('ET600');
      expect(query.executionState()).toMatchObject({ type: 'failure', hasCachedResponse: false });

      c.destroy();
    });
  });

  describe('creator options', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends a gql creator with an explicit route to that route', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: 'default', name: 'Ada' } } } }));
      s.api.on('POST', '/graphql/admin', () => ({ body: { data: { user: { id: 'admin', name: 'Grace' } } } }));

      const gqlPost = createGqlQueryViaPost(s.clientRef);
      const getUser = gqlPost<{ response: UserResponse }>(getUserDoc);
      const getAdminUser = gqlPost<{ response: UserResponse }>(getUserDoc, { route: '/graphql/admin' });

      const c = s.consumer();
      const base = c.run(() => getUser());
      const admin = c.run(() => getAdminUser());
      s.tick();

      expect(s.api.requestCount('POST', '/')).toBe(1);
      expect(s.api.requestCount('POST', '/graphql/admin')).toBe(1);
      expect(base.response()).toEqual({ user: { id: 'default', name: 'Ada' } });
      expect(admin.response()).toEqual({ user: { id: 'admin', name: 'Grace' } });

      c.destroy();
    });
  });

  describe('a gql query is a regular query', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('polls a gql query on the documented interval', () => {
      const s = scenario();
      s.api.on('GET', '/', () => ({ body: { data: { user: { id: '1', name: 'Ada' } } } }));

      const getUser = createGqlQueryViaGet(s.clientRef)<{ response: UserResponse; variables: UserVariables }>(
        getUserDoc,
      );

      const c = s.consumer();
      const query = c.run(() =>
        getUser(
          withArgs(() => ({ variables: { userId: '1' } })),
          withPolling({ interval: 30_000 }),
        ),
      );

      s.tick();
      expect(s.api.requestCount('GET', '/')).toBe(1);
      expect(query.response()).toEqual({ user: { id: '1', name: 'Ada' } });

      s.tick(30_000 * 2);
      expect(s.api.requestCount('GET', '/')).toBe(3);

      c.destroy();
      s.tick(30_000 * 2);
      expect(s.api.requestCount('GET', '/')).toBe(3);
    });
  });
  describe('document preparation', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('prepares the document once per creator instead of once per execution', () => {
      const s = scenario();
      s.api.on('GET', '/', () => ({ body: { data: { user: { id: '1', name: 'Ada' } } } }));

      const getUser = createGqlQueryViaGet(s.clientRef)<{ response: UserResponse; variables: UserVariables }>(
        getUserDoc,
      );

      const c = s.consumer();

      const { parses } = countingDocumentParses(() => {
        c.run(() =>
          getUser(
            withArgs(() => ({ variables: { userId: '1' } })),
            withPolling({ interval: 30_000 }),
          ),
        );

        s.tick();
        s.tick(30_000 * 3);
      });

      expect(s.api.requestCount('GET', '/')).toBe(4);
      expect(parses).toBe(1);

      c.destroy();
    });

    it('prepares the document once for two queries built from the same creator', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: '1', name: 'Ada' } } } }));

      const getUser = createGqlQueryViaPost(s.clientRef)<{ response: UserResponse; variables: UserVariables }>(
        getUserDoc,
      );

      const c = s.consumer();

      const { parses } = countingDocumentParses(() => {
        c.run(() => getUser(withArgs(() => ({ variables: { userId: '1' } }))));
        c.run(() => getUser(withArgs(() => ({ variables: { userId: '2' } }))));

        s.tick();
      });

      expect(s.api.requestCount('POST', '/')).toBe(2);
      expect(parses).toBe(1);

      c.destroy();
    });
  });
});
