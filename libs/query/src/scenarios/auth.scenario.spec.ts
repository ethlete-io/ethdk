import { HttpErrorResponse } from '@angular/common/http';
import { createSecureGetQuery, withInactivityLogout } from '../index';
import { describe, expect, it, vi } from 'vitest';
import { mintToken, useScenario } from './harness';

describe('auth scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('login stores tokens, and a secure query sends the bearer header while a non-secure one does not', () => {
    const s = scenario();
    const auth = s.auth();

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));
    s.api.on('GET', '/public/info', () => ({ body: { version: 1 } }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: { email: 'a@test.com', password: 'secret' } }));
    s.tick();

    expect(auth.accessToken()).not.toBeNull();
    expect(auth.refreshToken()).not.toBeNull();
    expect(auth.isAuthenticated()).toBe(true);

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');
    const getPublicInfo = s.get<{ response: { version: number } }>('/public/info');

    const secureQuery = c.run(() => getSecureProfile());
    const publicQuery = c.run(() => getPublicInfo());
    s.tick();

    expect(secureQuery.response()).toEqual({ id: 'me' });
    expect(publicQuery.response()).toEqual({ version: 1 });

    const secureRequest = s.api.requests.find((r) => r.path === '/secure/profile');
    const publicRequest = s.api.requests.find((r) => r.path === '/public/info');

    expect(secureRequest?.headers.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);
    expect(publicRequest?.headers.has('Authorization')).toBe(false);

    c.destroy();
  });

  it('schedules a proactive refresh that fires at the configured buffer', () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: 0.5 });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    const firstAccessToken = auth.accessToken();
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    // buffer = tokenLifetime * (1 - refreshStrategy) = 20000 * 0.5 = 10000ms before expiry
    s.tick(10000);
    s.tick();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.accessToken()).not.toBe(firstAccessToken);

    c.destroy();
  });

  it('a secure query waits for an in-flight refresh instead of sending an expired access token', () => {
    const s = scenario();
    const auth = s.auth({
      accessTokenExpiresInMs: -1000,
      refreshStrategy: { percentage: 0.99, minBufferMs: 100, maxBufferMs: 100000 },
    });

    // Breaks the cascade: without this, the refresh response mints another already-expired token
    // (same `accessTokenExpiresInMs`), and each refresh schedules another one immediately.
    s.api.once('POST', '/auth/refresh', () => ({
      body: {
        accessToken: mintToken({ expiresInMs: 600000 }),
        refreshToken: mintToken({ expiresInMs: 3600000 }),
      },
    }));

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    expect(auth.isAccessTokenExpired()).toBe(true);
    expect(s.api.pending().some((r) => r.path === '/auth/refresh')).toBe(true);

    const tokenAtWait = auth.accessToken();
    const secureQuery = c.run(() => getSecureProfile());

    expect(s.api.requestCount('GET', '/secure/profile')).toBe(0);
    expect(secureQuery.loading()).not.toBeNull();

    s.tick(); // the refresh resolves and applies a new token
    s.tick(); // the secure query resumes and its GET resolves

    expect(auth.accessToken()).not.toBe(tokenAtWait);
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(1);
    expect(secureQuery.response()).toEqual({ id: 'me' });

    const secureRequest = s.api.requests.find((r) => r.path === '/secure/profile');
    expect(secureRequest?.headers.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);

    c.destroy();
  });

  it('a 401 on a secure query with autoRetryOn401 triggers exactly one refresh and one retry', async () => {
    const s = scenario();
    const auth = s.auth({ autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    const secureQuery = c.run(() => getSecureProfile());
    s.flush();
    await s.settle();
    s.flush();

    expect(s.api.requestCount('GET', '/secure/profile')).toBe(2);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(secureQuery.error()).toBeNull();
    expect(secureQuery.response()).toEqual({ id: 'me' });

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);

    c.destroy();
  });

  it('a refresh failure runs onRefreshFailure, ends the session, and unbinds secure cache entries', () => {
    const s = scenario();
    const auth = s.auth({ autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.once('POST', '/auth/refresh', () => ({ status: 400, body: { message: 'refresh token revoked' } }));

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    const secureQuery = c.run(() => getSecureProfile());
    s.flush();

    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('expired');
    expect(auth.accessToken()).toBeNull();
    expect(auth.refreshToken()).toBeNull();
    expect(secureQuery.response()).toBeNull();
    expect(s.client.repository.subtle.cacheEntries().some((entry) => entry.isSecure)).toBe(false);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);

    c.destroy();
  });

  it('logout while a refresh is in flight leaves the tokens null when the late response lands', () => {
    const s = scenario();
    const auth = s.auth();

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    const staleRefreshToken = auth.refreshToken();
    expect(staleRefreshToken).not.toBeNull();

    s.api.once('POST', '/auth/refresh', () => ({
      body: {
        accessToken: mintToken({ expiresInMs: 900000 }),
        refreshToken: mintToken({ expiresInMs: 3600000 }),
      },
      delay: 1000,
    }));

    s.run(() => auth.queries.refresh.execute({ body: { token: staleRefreshToken! } }));
    s.run(() => auth.logout());

    expect(auth.accessToken()).toBeNull();
    expect(auth.refreshToken()).toBeNull();

    s.tick(1000); // the delayed refresh response lands after the logout

    expect(auth.accessToken()).toBeNull();
    expect(auth.refreshToken()).toBeNull();
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('user');

    c.destroy();
  });

  it('logout while a login is in flight leaves the tokens null when the late response lands', () => {
    const s = scenario();
    const auth = s.auth();

    s.api.once('POST', '/auth/login', () => ({
      body: {
        accessToken: mintToken({ expiresInMs: 900000 }),
        refreshToken: mintToken({ expiresInMs: 3600000 }),
      },
      delay: 1000,
    }));

    const c = s.consumer();
    s.run(() => auth.queries.login.execute({ body: {} }));
    s.run(() => auth.logout());

    expect(auth.accessToken()).toBeNull();

    s.tick(1000); // the delayed login response lands after the logout

    expect(auth.accessToken()).toBeNull();
    expect(auth.refreshToken()).toBeNull();
    expect(auth.sessionStatus()).toBe('anonymous');

    c.destroy();
  });

  it('withInactivityLogout logs out once the idle window elapses', () => {
    const s = scenario();
    const inactivityFeature = withInactivityLogout({ inactivityTimeout: 5000 });
    const auth = s.auth({ features: [inactivityFeature] });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    expect(auth.isAuthenticated()).toBe(true);

    s.tick(5000);

    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('inactivity');
    expect(auth.accessToken()).toBeNull();

    c.destroy();
  });

  it('destroy with a scheduled refresh timer still pending leaves no timer behind', () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 60 * 60 * 1000 });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    expect(auth.accessToken()).not.toBeNull();
    // The proactive refresh is armed for later in this token's lifetime and never fires in this test -
    // proving it was armed at all is the point; the timers invariant is what would have caught it
    // staying armed forever.
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    c.destroy();
  });
});
