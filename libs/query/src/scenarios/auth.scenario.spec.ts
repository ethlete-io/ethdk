import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { createUnsavedChangesTracker, injectUnsavedChangesCoordinator } from '@ethlete/core';
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

  it('a 2xx login whose body carries no tokens ends in an error instead of staying in the loading state', () => {
    const s = scenario();
    const auth = s.auth();
    s.api.once('POST', '/auth/login', () => ({ status: 200, body: null }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    expect(auth.executionState()).toMatchObject({ type: 'login', state: 'error' });
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.accessToken()).toBeNull();
    expect(auth.sessionStatus()).toBe('anonymous');

    s.expectError(/Failed to extract tokens from login response/);

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

  it('exposes the decoded JWT claims through bearerData(), and clears them on logout', async () => {
    const s = scenario();
    const auth = s.auth();

    s.api.once('POST', '/auth/login', () => ({
      body: {
        accessToken: mintToken({ expiresInMs: 900000, claims: { sub: 'user-1', role: 'admin' } }),
        refreshToken: mintToken({ expiresInMs: 3600000 }),
      },
    }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.bearerData()).toMatchObject({ sub: 'user-1', role: 'admin' });

    s.run(() => auth.logout());
    s.tick();

    expect(auth.bearerData()).toBeNull();

    c.destroy();
  });

  it('decodes the access token with a custom bearerDecryptFn', async () => {
    const s = scenario();
    const auth = s.auth({ bearerDecryptFn: (token: string) => ({ decodedBy: 'custom', length: token.length }) });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.bearerData()).toEqual({ decodedBy: 'custom', length: auth.accessToken()?.length });

    c.destroy();
  });

  it('isAccessTokenExpired() flips with the clock without any token change', () => {
    const s = scenario();
    // A buffer of zero puts the proactive refresh at the expiry itself, and its response never lands -
    // so the only thing that changes between the two reads is the clock.
    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: 1 });

    s.api.once('POST', '/auth/refresh', () => ({
      body: { accessToken: mintToken({ expiresInMs: 900000 }), refreshToken: mintToken({ expiresInMs: 3600000 }) },
      delay: 100000,
    }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    const tokenAtLogin = auth.accessToken();

    expect(auth.isAccessTokenExpired()).toBe(false);

    s.tick(19000);

    expect(auth.isAccessTokenExpired()).toBe(false);

    s.tick(1001);

    expect(auth.isAccessTokenExpired()).toBe(true);
    expect(auth.accessToken()).toBe(tokenAtLogin);

    s.tick(100000);
    s.tick();

    c.destroy();
  });

  it('records the cause an explicit logout(cause) passes', async () => {
    const s = scenario();
    const auth = s.auth();

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    s.run(() => auth.logout('expired'));
    s.tick();

    expect(auth.sessionEndCause()).toBe('expired');
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.executionState()).toEqual({ type: 'logout', state: 'success' });

    c.destroy();
  });

  it('clears sessionEndCause() once a new session starts', async () => {
    const s = scenario();
    const auth = s.auth();

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.sessionEndCause()).toBeNull();

    s.run(() => auth.logout());
    s.tick();

    expect(auth.sessionEndCause()).toBe('user');

    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.sessionEndCause()).toBeNull();
    expect(auth.sessionStatus()).toBe('authenticated');

    c.destroy();
  });

  it('logout abandons every unsaved-changes guard, and guards created after a re-login work again', async () => {
    const s = scenario();
    const auth = s.auth();
    const coordinator = s.run(() => injectUnsavedChangesCoordinator());

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const draft = signal('edited');
    c.run(() => createUnsavedChangesTracker({ source: draft, defaultValue: '', confirm: () => true, tab: false }));
    s.tick();

    expect(coordinator.hasUnsavedChanges()).toBe(true);

    s.run(() => auth.logout());
    s.tick();

    expect(coordinator.hasUnsavedChanges()).toBe(false);

    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const nextDraft = signal('edited again');
    c.run(() => createUnsavedChangesTracker({ source: nextDraft, defaultValue: '', confirm: () => true, tab: false }));
    s.tick();

    expect(coordinator.hasUnsavedChanges()).toBe(true);

    c.destroy();
  });

  it('reports setTokens as a token seed that starts a session', () => {
    const s = scenario();
    const auth = s.auth();

    const accessToken = mintToken({ expiresInMs: 900000, claims: { sub: 'seeded' } });
    const refreshToken = mintToken({ expiresInMs: 3600000 });

    s.run(() => auth.setTokens(accessToken, refreshToken));
    s.tick();

    expect(auth.executionState()).toEqual({ type: 'tokenSeed', state: 'success' });
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.sessionStatus()).toBe('authenticated');
    expect(auth.accessToken()).toBe(accessToken);
    expect(auth.bearerData()).toMatchObject({ sub: 'seeded' });
  });

  it('a background token refresh overwrites the login executionState() but not the login snapshot', async () => {
    const s = scenario();
    const auth = s.auth();

    const c = s.consumer();
    const attempt = c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.executionState()).toMatchObject({ type: 'login', state: 'success' });
    expect(auth.queries.login.snapshot()).toBe(attempt);
    expect(attempt.loading()).toBeNull();
    expect(attempt.error()).toBeNull();

    s.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken()! } }));
    await s.settle();

    expect(auth.executionState()).toMatchObject({ type: 'tokenRefresh', state: 'success' });
    expect(auth.queries.login.snapshot()).toBe(attempt);
    expect(attempt.loading()).toBeNull();
    expect(attempt.error()).toBeNull();

    c.destroy();
  });

  it('the most recently started token-issuing execution wins, and the earlier pair is dropped when it lands late', async () => {
    const s = scenario();
    const auth = s.auth();

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: { attempt: 1 } }));
    await s.settle();

    const loginPair = {
      accessToken: mintToken({ expiresInMs: 900000, claims: { sub: 'logged-in' } }),
      refreshToken: mintToken({ expiresInMs: 3600000, claims: { sub: 'logged-in' } }),
    };
    const refreshPair = {
      accessToken: mintToken({ expiresInMs: 900000, claims: { sub: 'refreshed' } }),
      refreshToken: mintToken({ expiresInMs: 3600000, claims: { sub: 'refreshed' } }),
    };

    s.api.once('POST', '/auth/login', () => ({ body: loginPair, delay: 2000 }));
    s.api.once('POST', '/auth/refresh', () => ({ body: refreshPair, delay: 100 }));

    s.run(() => auth.queries.login.execute({ body: { attempt: 2 } }));
    s.tick();
    s.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken()! } }));
    s.tick(101);

    expect(auth.accessToken()).toBe(refreshPair.accessToken);

    s.tick(2000);
    s.tick();

    expect(s.api.requests.filter((r) => r.path === '/auth/login').map((r) => r.status)).toEqual([200, 200]);
    expect(auth.accessToken()).toBe(refreshPair.accessToken);
    expect(auth.refreshToken()).toBe(refreshPair.refreshToken);
    expect(auth.executionState()).toMatchObject({ type: 'tokenRefresh', state: 'success' });

    c.destroy();
  });

  it('a login supersedes an in-flight token refresh, whose late pair is dropped entirely', async () => {
    const s = scenario();
    const auth = s.auth();

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const refreshPair = {
      accessToken: mintToken({ expiresInMs: 900000, claims: { sub: 'refreshed' } }),
      refreshToken: mintToken({ expiresInMs: 3600000, claims: { sub: 'refreshed' } }),
    };
    const loginPair = {
      accessToken: mintToken({ expiresInMs: 900000, claims: { sub: 'logged-in' } }),
      refreshToken: mintToken({ expiresInMs: 3600000, claims: { sub: 'logged-in' } }),
    };

    s.api.once('POST', '/auth/refresh', () => ({ body: refreshPair, delay: 2000 }));
    s.api.once('POST', '/auth/login', () => ({ body: loginPair, delay: 100 }));

    s.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken()! } }));
    s.tick();
    s.run(() => auth.queries.login.execute({ body: { attempt: 2 } }));
    s.tick(101);

    expect(auth.accessToken()).toBe(loginPair.accessToken);
    expect(auth.executionState()).toMatchObject({ type: 'login', state: 'success' });

    s.tick(2000);
    s.tick();

    expect(auth.accessToken()).toBe(loginPair.accessToken);
    expect(auth.refreshToken()).toBe(loginPair.refreshToken);
    expect(auth.executionState()).toMatchObject({ type: 'login', state: 'success' });

    c.destroy();
  });

  it('holds a proactive refresh while a login is in flight, but runs an explicit one', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: 0.5 });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: { attempt: 1 } }));
    await s.settle();

    s.api.once('POST', '/auth/login', () => ({
      body: { accessToken: mintToken({ expiresInMs: 900000 }), refreshToken: mintToken({ expiresInMs: 3600000 }) },
      delay: 30000,
    }));

    s.run(() => auth.queries.login.execute({ body: { attempt: 2 } }));
    s.tick();

    // Past the proactive refresh of the first token, which is due at half its 20s lifetime.
    s.tick(12000);
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    s.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken()! } }));
    s.tick();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    s.tick(30000);
    await s.settle();
    s.flush();

    c.destroy();
  });
});
