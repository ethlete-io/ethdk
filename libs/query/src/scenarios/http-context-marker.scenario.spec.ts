import { HttpClient, HttpInterceptorFn, provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { inject } from '@angular/core';
import { createGqlQueryViaGet, createGqlQueryViaPost, gql, IS_QUERY_REQUEST, withArgs } from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

const APP_TOKEN = 'Bearer app-token';

const getUserDoc = gql`
  query GetUser($userId: ID!) {
    user(id: $userId) {
      id
    }
  }
`;

type GqlUser = { response: { user: { id: string } }; variables: { userId: string } };

const seen: { method: string; url: string; isQueryRequest: boolean }[] = [];

const appAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const isQueryRequest = req.context.get(IS_QUERY_REQUEST);
  seen.push({ method: req.method, url: req.urlWithParams, isQueryRequest });

  if (isQueryRequest) return next(req);

  return next(req.clone({ setHeaders: { Authorization: APP_TOKEN } }));
};

describe('http context marker scenario', () => {
  // A second `provideHttpClient()` replaces the harness's fake `HttpBackend`; `withXhr()` still reaches
  // the fake API through the `XMLHttpRequest` the harness patches.
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    providers: () => {
      seen.length = 0;
      return [provideHttpClient(withXhr(), withInterceptors([appAuthInterceptor]))];
    },
  });

  it('marks http, gql and auth requests so an app interceptor can skip them, and leaves a plain HttpClient call unmarked', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 60000 });

    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));
    s.api.on('GET', '/', () => ({ body: { data: { user: { id: 'g1' } } } }));
    s.api.on('POST', '/', () => ({ body: { data: { user: { id: 'g2' } } } }));
    s.api.on('GET', '/plain', () => ({ body: { ok: true } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);
    const getGqlUser = createGqlQueryViaGet(s.clientRef)<GqlUser>(getUserDoc);
    const postGqlUser = createGqlQueryViaPost(s.clientRef)<GqlUser>(getUserDoc);

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    c.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken() ?? '' } }));
    await s.settle();

    const user = c.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));
    const gqlGet = c.run(() => getGqlUser(withArgs(() => ({ variables: { userId: 'g1' } }))));
    const gqlPost = c.run(() => postGqlUser(withArgs(() => ({ variables: { userId: 'g2' } }))));

    let plainBody: unknown = null;
    s.run(() =>
      inject(HttpClient)
        .get('https://api.test/plain')
        .subscribe((body) => (plainBody = body)),
    );

    await s.settle();

    expect(user.response()).toEqual({ id: '1' });
    expect(gqlGet.response()).toEqual({ user: { id: 'g1' } });
    expect(gqlPost.response()).toEqual({ user: { id: 'g2' } });
    expect(plainBody).toEqual({ ok: true });

    expect(seen.map(({ method, url, isQueryRequest }) => [method, url.split('?')[0], isQueryRequest])).toEqual([
      ['POST', 'https://api.test/auth/login', true],
      ['POST', 'https://api.test/auth/refresh', true],
      ['GET', 'https://api.test/plain', false],
      ['GET', 'https://api.test/users/1', true],
      ['GET', 'https://api.test/', true],
      ['POST', 'https://api.test', true],
    ]);

    const authorizationOf = (method: string, path: string) =>
      s.api.requests.filter((r) => r.method === method && r.path === path).map((r) => r.headers.get('Authorization'));

    expect(authorizationOf('GET', '/users/1')).toEqual([null]);
    expect(authorizationOf('POST', '/auth/refresh')).toEqual([null]);
    expect(authorizationOf('GET', '/plain')).toEqual([APP_TOKEN]);

    c.destroy();
  });
});
