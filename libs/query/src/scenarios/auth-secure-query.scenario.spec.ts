import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { createSecureGetQuery, createSecurePostQuery, withArgs } from '../index';
import { describe, expect, it } from 'vitest';
import { mintToken, useScenario } from './harness';

type Profile = { response: { id: string } };

const is401 = (entry: { error: unknown }) => entry.error instanceof HttpErrorResponse && entry.error.status === 401;

describe('auth secure query scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('a 401 landing after a refresh already replaced the token retries with the new token and refreshes nothing', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: 0.5, autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' }, delay: 12000 }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const tokenAtRequest = auth.accessToken();
    const query = c.run(() => getSecureProfile());
    s.tick();
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(1);

    s.tick(10000);
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    const tokenAfterRefresh = auth.accessToken();
    expect(tokenAfterRefresh).not.toBe(tokenAtRequest);

    s.tick(2000);
    await s.settle();
    s.flush();
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(2);
    expect(query.response()).toEqual({ id: 'me' });

    const retried = s.api.requests.filter((r) => r.path === '/secure/profile')[1];
    expect(retried?.headers.get('Authorization')).toBe(`Bearer ${tokenAfterRefresh}`);

    s.expectError(is401);
    c.destroy();
  });

  it('two secure queries failing with 401 at once share one refresh and both retry', async () => {
    const s = scenario();
    const auth = s.auth({ autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/a', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.once('GET', '/secure/b', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/a', () => ({ body: { id: 'a' } }));
    s.api.on('GET', '/secure/b', () => ({ body: { id: 'b' } }));

    const getA = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/a');
    const getB = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/b');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const queryA = c.run(() => getA());
    const queryB = c.run(() => getB());
    s.flush();
    await s.settle();
    s.flush();
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(s.api.requestCount('GET', '/secure/a')).toBe(2);
    expect(s.api.requestCount('GET', '/secure/b')).toBe(2);
    expect(queryA.response()).toEqual({ id: 'a' });
    expect(queryB.response()).toEqual({ id: 'b' });

    s.expectError(is401);
    s.expectError(is401);
    c.destroy();
  });

  it('a refresh that hands back the same access token does not retry the 401, and the next one that changes it does', async () => {
    const s = scenario();
    const auth = s.auth({ autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));
    s.api.once('POST', '/auth/refresh', () => ({
      body: { accessToken: auth.accessToken()!, refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));

    const getSecureProfile = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const tokenAtLogin = auth.accessToken();
    const query = c.run(() => getSecureProfile());
    s.flush();
    await s.settle();
    s.flush();
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.accessToken()).toBe(tokenAtLogin);
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(1);
    expect(query.error()?.code).toBe(401);

    s.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken()! } }));
    s.flush();
    await s.settle();
    s.flush();
    await s.settle();

    expect(auth.accessToken()).not.toBe(tokenAtLogin);
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(2);
    expect(query.error()).toBeNull();
    expect(query.response()).toEqual({ id: 'me' });

    s.expectError(is401);
    c.destroy();
  });

  it('a logout while a secure request is in flight drops its late response and spends no refresh on its late 401', async () => {
    const s = scenario();
    const auth = s.auth({ autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/slow', () => ({ body: { id: 'me' }, delay: 5000 }));
    s.api.on('GET', '/secure/revoked', () => ({ status: 401, body: { message: 'revoked' }, delay: 5000 }));

    const getSlow = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/slow');
    const getRevoked = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/revoked');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const slow = c.run(() => getSlow());
    const revoked = c.run(() => getRevoked());
    s.tick();
    expect(s.api.pending()).toHaveLength(2);

    s.run(() => auth.logout());
    s.tick(5000);
    await s.settle();
    s.flush();
    await s.settle();

    expect(slow.response()).toBeNull();
    expect(revoked.error()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    c.destroy();
  });

  it('a secure query still mounted across a logout runs again for the next session, a mutation does not', async () => {
    const s = scenario();
    const auth = s.auth();
    let user = 'first';

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: user } }));
    s.api.on('POST', '/secure/profile', () => ({ body: { id: user } }));

    const getSecureProfile = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/profile');
    const updateSecureProfile = createSecurePostQuery(
      s.clientRef,
      auth.ref,
    )<Profile & { body: { name: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const query = c.run(() => getSecureProfile());
    const mutation = c.run(() => updateSecureProfile());
    mutation.execute({ args: { body: { name: 'x' } } });
    s.flush();
    await s.settle();

    expect(query.response()).toEqual({ id: 'first' });
    expect(mutation.response()).toEqual({ id: 'first' });

    s.run(() => auth.logout());
    s.tick();

    expect(query.response()).toBeNull();
    expect(mutation.response()).toBeNull();

    user = 'second';
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    s.flush();
    await s.settle();

    expect(query.response()).toEqual({ id: 'second' });
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(2);
    expect(s.api.requestCount('POST', '/secure/profile')).toBe(1);
    expect(mutation.response()).toBeNull();

    const rerun = s.api.requests.filter((r) => r.path === '/secure/profile' && r.method === 'GET')[1];
    expect(rerun?.headers.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);

    c.destroy();
  });

  it('a secure query that already has data reports the auth failure as its error', async () => {
    const s = scenario();
    const auth = s.auth({ onRefreshFailure: () => undefined });

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const query = c.run(() => getSecureProfile());
    s.flush();
    await s.settle();

    expect(query.response()).toEqual({ id: 'me' });

    s.api.once('POST', '/auth/refresh', () => ({ status: 400, body: { message: 'refresh token rejected' } }));
    s.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken()! } }));
    s.flush();
    await s.settle();

    query.execute();
    s.flush();
    await s.settle();

    expect(query.error()?.code).toBe(400);
    expect(query.executionState()?.type).toBe('failure');
    expect(query.response()).toBeNull();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('leaves an Authorization header the caller set in place instead of injecting the bearer token', async () => {
    const s = scenario();
    const auth = s.auth();

    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const query = c.run(() =>
      getSecureProfile(withArgs(() => ({ headers: new HttpHeaders({ Authorization: 'Bearer caller-token' }) }))),
    );
    await s.settle();

    expect(query.response()).toEqual({ id: 'me' });
    expect(s.api.requests.find((r) => r.path === '/secure/profile')?.headers.get('Authorization')).toBe(
      'Bearer caller-token',
    );
    expect(auth.accessToken()).not.toBe('caller-token');

    c.destroy();
  });

  it('parks a secure query executed before login and sends it once the login lands', async () => {
    const s = scenario();
    const auth = s.auth();

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/profile');

    const c = s.consumer();
    const query = c.run(() => getSecureProfile());
    s.tick();

    expect(s.api.requestCount('GET', '/secure/profile')).toBe(0);
    expect(query.error()).toBeNull();
    expect(query.loading()).not.toBeNull();

    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    s.flush();

    expect(s.api.requestCount('GET', '/secure/profile')).toBe(1);
    expect(query.response()).toEqual({ id: 'me' });
    expect(s.api.requests.find((r) => r.path === '/secure/profile')?.headers.get('Authorization')).toBe(
      `Bearer ${auth.accessToken()}`,
    );

    c.destroy();
  });

  it('sends the expired access token after 5 seconds when no refresh arrives', () => {
    const s = scenario();
    const auth = s.auth();

    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/profile');

    // A seeded pair with an expired access token and no refresh token to spend: nothing can end the
    // wait but the timeout.
    const expiredToken = mintToken({ expiresInMs: -1000 });

    const c = s.consumer();
    s.run(() => auth.setTokens(expiredToken, ''));
    s.tick();

    expect(auth.isAccessTokenExpired()).toBe(true);

    const query = c.run(() => getSecureProfile());
    s.tick();
    s.tick(4000);

    expect(s.api.requestCount('GET', '/secure/profile')).toBe(0);

    s.tick(1001);

    expect(s.api.requestCount('GET', '/secure/profile')).toBe(1);
    expect(s.api.requests.find((r) => r.path === '/secure/profile')?.headers.get('Authorization')).toBe(
      `Bearer ${expiredToken}`,
    );
    expect(query.response()).toEqual({ id: 'me' });

    c.destroy();
  });

  it('sends an opaque access token immediately and reports it as not expired', async () => {
    const s = scenario();
    const auth = s.auth();

    s.api.once('POST', '/auth/login', () => ({
      body: { accessToken: 'opaque-access-token', refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    expect(auth.isAccessTokenExpired()).toBe(false);

    const query = c.run(() => getSecureProfile());
    s.tick();

    expect(s.api.requestCount('GET', '/secure/profile')).toBe(1);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);
    expect(s.api.requests.find((r) => r.path === '/secure/profile')?.headers.get('Authorization')).toBe(
      'Bearer opaque-access-token',
    );
    expect(query.response()).toEqual({ id: 'me' });

    c.destroy();
  });

  it('sends an expired token straight out with refreshIfExpired: false', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: -1000, refreshIfExpired: false });

    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    const expiredToken = auth.accessToken();

    expect(auth.isAccessTokenExpired()).toBe(false);

    const query = c.run(() => getSecureProfile());
    s.tick();

    expect(s.api.requestCount('GET', '/secure/profile')).toBe(1);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);
    expect(s.api.requests.find((r) => r.path === '/secure/profile')?.headers.get('Authorization')).toBe(
      `Bearer ${expiredToken}`,
    );
    expect(query.response()).toEqual({ id: 'me' });

    c.destroy();
  });
});
