import { HttpErrorResponse } from '@angular/common/http';
import { effect, EnvironmentInjector, inject } from '@angular/core';
import {
  createBearerAuthProvider,
  createSecureGetQuery,
  QueryErrorResponse,
  TokenRefreshQueryConfig,
  withAuthenticationQuery,
  withRefreshQuery,
} from '../index';
import { describe, expect, it, vi } from 'vitest';
import { mintToken, Scenario, useScenario } from './harness';

type TokenArgs = { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } };

let providerCounter = 0;

/**
 * Unlike `s.auth()`, leaves `extractTokens` to the provider's default - the one that validates the
 * response shape - unless a scenario hands in its own.
 */
const createAuth = (
  s: Scenario,
  config: Omit<TokenRefreshQueryConfig<TokenArgs>, 'queryCreator'> & { accessTokenExpiresInMs?: number } = {},
) => {
  const { accessTokenExpiresInMs = 15 * 60 * 1000, ...refreshConfig } = config;
  const issue = () => ({
    body: {
      accessToken: mintToken({ expiresInMs: accessTokenExpiresInMs }),
      refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
    },
  });

  s.api.on('POST', '/auth/login', issue);
  s.api.on('POST', '/auth/refresh', issue);

  const ref = createBearerAuthProvider({
    name: `auth-lifecycle-${++providerCounter}`,
    queryClientRef: s.clientRef,
    queries: [
      withAuthenticationQuery('login', {
        queryCreator: s.post<TokenArgs>('/auth/login'),
        extractTokens: refreshConfig.extractTokens,
      }),
      withRefreshQuery('refresh', { queryCreator: s.post<TokenArgs>('/auth/refresh'), ...refreshConfig }),
    ],
  });

  const provider = s.run(() => ref.inject());

  if (!provider) throw new Error('auth lifecycle scenario: failed to create the auth provider');

  return Object.assign(provider, { ref });
};

describe('auth token lifecycle scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('every way a token pair arrives emits afterTokenRefresh$ exactly once', async () => {
    const s = scenario();
    const auth = s.auth({ autoRetryOn401: true });
    const emissions: string[] = [];
    const subscription = auth.afterTokenRefresh$.subscribe(() => emissions.push(auth.accessToken() ?? 'null'));

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    expect(emissions).toHaveLength(1);

    c.run(() => getSecureProfile());
    s.flush();
    await s.settle();
    s.flush();
    await s.settle();
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(emissions).toHaveLength(2);

    s.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken()! } }));
    await s.settle();
    expect(emissions).toHaveLength(3);

    s.run(() => auth.setTokens(mintToken({ expiresInMs: 600000 }), mintToken({ expiresInMs: 3600000 })));
    await s.settle();
    expect(emissions).toHaveLength(4);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
    subscription.unsubscribe();
    c.destroy();
  });

  it('reports both the proactive and the 401-driven refresh as tokenRefresh', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: 0.5, autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.executionState()).toMatchObject({ type: 'login', state: 'success' });

    await s.settle(10001);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.executionState()).toMatchObject({ type: 'tokenRefresh', state: 'success' });

    c.run(() => auth.queries.login.execute({ body: { attempt: 2 } }));
    await s.settle();

    expect(auth.executionState()).toMatchObject({ type: 'login', state: 'success' });

    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    c.run(() => getSecureProfile());
    s.flush();
    await s.settle();
    s.flush();
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(2);
    expect(auth.executionState()).toMatchObject({ type: 'tokenRefresh', state: 'success' });

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
    c.destroy();
  });

  it('computes the refresh schedule from a custom expiresInPropertyName claim', async () => {
    const s = scenario();

    const eatToken = (expiresInMs: number) =>
      mintToken({ expiresInMs, claims: { exp: undefined, eat: Math.floor((Date.now() + expiresInMs) / 1000) } });

    s.api.once('POST', '/auth/login', () => ({
      body: { accessToken: eatToken(20000), refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }) },
    }));

    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: 0.5, expiresInPropertyName: 'eat' });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.settle(9000);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    await s.settle(1000);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    c.destroy();
  });

  it('refreshes at 75% of the token lifetime by default', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 20 * 60 * 1000 });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    // 75% of a 20 minute lifetime leaves a 5 minute buffer, which is inside the 1-10 minute clamp.
    await s.settle(14 * 60 * 1000);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    await s.settle(60 * 1000);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    c.destroy();
  });

  it('clamps the default refresh buffer to a minute for a short-lived token', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 90 * 1000 });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    // 25% of 90s is 22.5s, so the minimum buffer of a minute decides: the refresh is due after 30s.
    await s.settle(29 * 1000);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    await s.settle(1000);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    c.destroy();
  });

  it('clamps the default refresh buffer to ten minutes for a long-lived token', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 2 * 60 * 60 * 1000 });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    // 25% of two hours is 30 minutes, so the maximum buffer of 10 minutes decides: due after 110.
    await s.settle(109 * 60 * 1000);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    await s.settle(60 * 1000);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    c.destroy();
  });

  it('the object form of refreshStrategy clamps the percentage buffer to maxBufferMs', async () => {
    const s = scenario();
    const auth = s.auth({
      accessTokenExpiresInMs: 20000,
      refreshStrategy: { percentage: 0.5, minBufferMs: 100, maxBufferMs: 5000 },
    });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    // The percentage asks for a 10s buffer; the maximum cuts it to 5s, so the refresh is due after 15s.
    await s.settle(14000);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    await s.settle(1000);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    c.destroy();
  });

  it('refreshes and retries a 401 with the default autoRetryOn401', async () => {
    const s = scenario();
    const auth = createAuth(s);

    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const query = c.run(() => getSecureProfile());
    s.flush();
    await s.settle();
    s.flush();
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(2);
    expect(query.response()).toEqual({ id: 'me' });

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
    c.destroy();
  });

  it('neither refreshes nor retries a 401 with autoRetryOn401: false', async () => {
    const s = scenario();
    const auth = createAuth(s, { autoRetryOn401: false });

    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const query = c.run(() => getSecureProfile());
    s.flush();
    await s.settle();
    s.flush();
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(1);
    expect(query.error()?.code).toBe(401);
    expect(auth.isAuthenticated()).toBe(true);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
    c.destroy();
  });

  it('a proactive tick right after a 401-driven rotation is throttled by the default 30s minRefreshInterval', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 40000, refreshStrategy: 0.5, autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    c.run(() => getSecureProfile());

    // Each 401/refresh round arms its next timer one microtask after the last; flush() never awaits.
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
      s.tick(50);
    }

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    // The rotated token is due for its proactive refresh 20s on, which is inside the 30s floor the
    // 401-driven rotation started.
    await s.settle(24000);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    await s.settle(11000);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(2);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
    c.destroy();
  });

  it('re-arms a proactive refresh it could not run five times and then stops, until a new pair restarts the schedule', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: 0.5 });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    // In flight from t=1s to t=40s, so every proactive tick in between finds a token-issuing
    // execution running and declines to spend the refresh token.
    s.api.once('POST', '/auth/login', () => ({ status: 401, body: { message: 'rejected' }, delay: 39000 }));

    await s.settle(1000);
    c.run(() => auth.queries.login.execute({ body: { attempt: 2 } }));
    await s.settle();

    // The tick due at t=10s and its five re-arms, 5s apart, are all spent by t=35s.
    await s.settle(39000);
    s.flush();
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);
    expect(auth.isAuthenticated()).toBe(true);

    await s.settle(20000);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    s.run(() => auth.setTokens(mintToken({ expiresInMs: 20000 }), mintToken({ expiresInMs: 60 * 60 * 1000 })));
    await s.settle();
    await s.settle(10001);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
    c.destroy();
  });

  it('recomputes the refresh schedule on visibilitychange and refreshes a token already inside the buffer', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 90000 });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    // A frozen tab: the clock moves on while its timers do not run, so the armed refresh keeps its
    // remaining delay while the token it holds moves inside the one-minute refresh buffer.
    vi.setSystemTime(Date.now() + 40000);
    s.tick();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    document.dispatchEvent(new Event('visibilitychange'));
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.isAuthenticated()).toBe(true);

    c.destroy();
  });

  it('retries a refresh past the normal attempt limit and caps the backoff at 30 seconds', async () => {
    const s = scenario();
    const auth = s.auth();

    for (let i = 0; i < 7; i++) {
      s.api.once('POST', '/auth/refresh', () => ({ status: 503, body: { message: 'unavailable' } }));
    }

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    s.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken()! } }));

    for (let i = 0; i < 5; i++) await s.settle(25000);

    const attempts = s.api.requests.filter((r) => r.path === '/auth/refresh');
    const delays = attempts
      .slice(1)
      .map((request, index) => Math.round((request.at - (attempts[index]?.at ?? 0)) / 1000));

    expect(attempts).toHaveLength(8);
    expect(delays).toEqual([2, 4, 8, 16, 30, 30, 30]);
    expect(attempts[7]?.status).toBe(200);
    expect(auth.isAuthenticated()).toBe(true);

    c.destroy();
  });
});

describe('auth refresh failure scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('a refresh whose response carries no tokens ends the session like a rejected refresh', async () => {
    const s = scenario();
    const auth = createAuth(s, { accessTokenExpiresInMs: 20000, refreshStrategy: 0.5 });

    s.api.once('POST', '/auth/refresh', () => ({ body: { unexpected: true } }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.isAuthenticated()).toBe(true);

    s.tick(10000);
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.executionState()).toEqual({ type: 'logout', state: 'success' });
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('expired');
    expect(auth.accessToken()).toBeNull();

    s.expectError(/Failed to extract tokens/);

    c.destroy();
  });

  it('a custom extractTokens that hands back no token strings is treated as a failed refresh, not a session', async () => {
    const s = scenario();
    const auth = createAuth(s, {
      accessTokenExpiresInMs: 20000,
      refreshStrategy: 0.5,
      extractTokens: (response) => ({
        accessToken: (response as { data?: { accessToken: string } }).data?.accessToken as string,
        refreshToken: (response as { data?: { refreshToken: string } }).data?.refreshToken as string,
      }),
    });

    s.api.once('POST', '/auth/login', () => ({
      body: {
        data: { accessToken: mintToken({ expiresInMs: 20000 }), refreshToken: mintToken({ expiresInMs: 3600000 }) },
      },
    }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.isAuthenticated()).toBe(true);

    s.tick(10000);
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('expired');
    expect(auth.accessToken()).toBeNull();
    expect(auth.refreshToken()).toBeNull();

    s.expectError(/Failed to extract tokens/);

    c.destroy();
  });
  it('keeps the session when onRefreshFailure never calls logout()', async () => {
    const s = scenario();
    const auth = createAuth(s, {
      accessTokenExpiresInMs: 20000,
      refreshStrategy: 0.5,
      onRefreshFailure: () => undefined,
    });

    s.api.once('POST', '/auth/refresh', () => ({ status: 400, body: { message: 'refresh token rejected' } }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const tokenAtLogin = auth.accessToken();

    await s.settle(10001);
    s.flush();
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.sessionStatus()).toBe('authenticated');
    expect(auth.sessionEndCause()).toBeNull();
    expect(auth.accessToken()).toBe(tokenAtLogin);
    expect(auth.executionState()).toMatchObject({ type: 'tokenRefresh', state: 'error' });

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('reports a 2xx body extractTokens rejects as an error with code 0', async () => {
    const s = scenario();
    let seen: QueryErrorResponse | null = null;
    const auth = createAuth(s, {
      accessTokenExpiresInMs: 20000,
      refreshStrategy: 0.5,
      onRefreshFailure: ({ error, logout }) => {
        seen = error;
        logout();
      },
    });

    s.api.once('POST', '/auth/refresh', () => ({ status: 200, body: { unexpected: true } }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.settle(10001);
    s.flush();
    await s.settle();

    const failure = seen as QueryErrorResponse | null;

    expect(failure?.code).toBe(0);
    expect(String(failure?.raw.error)).toMatch(/ET20[12]/);
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('expired');

    s.expectError(/Failed to extract tokens/);
    c.destroy();
  });

  it('lets onRefreshFailure create an effect and a query, so it never runs in a reactive context', async () => {
    const s = scenario();
    const injector = s.run(() => inject(EnvironmentInjector));
    const effectRuns: number[] = [];
    let queryResponse: unknown = null;

    s.api.on('GET', '/after-failure', () => ({ body: { ok: true } }));

    const auth = createAuth(s, {
      accessTokenExpiresInMs: 20000,
      refreshStrategy: 0.5,
      onRefreshFailure: ({ logout }) => {
        effect(() => effectRuns.push(effectRuns.length), { injector });
        const query = injector.runInContext(() => s.get<{ response: { ok: boolean } }>('/after-failure')());

        effect(() => void (queryResponse = query.response()), { injector });
        logout();
      },
    });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    s.api.once('POST', '/auth/refresh', () => ({ status: 400, body: { message: 'refresh token rejected' } }));

    await s.settle(10001);
    s.flush();
    await s.settle();

    expect(effectRuns.length).toBeGreaterThan(0);
    expect(queryResponse).toEqual({ ok: true });
    expect(auth.sessionStatus()).toBe('anonymous');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });
});
