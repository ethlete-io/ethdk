import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  clearQueryDevtoolsTokenTtl,
  createAuthGuard,
  createBearerAuthProvider,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  isQueryDevtoolsEnabled,
  provideQueryDevtools,
  queryDevtoolsTokenTtls,
  setQueryDevtoolsTokenTtl,
  withAuthenticationQuery,
  withPersistentAuth,
  withRefreshQuery,
  withTokenExpirationWarning,
  withTokenRevocation,
} from '../index';
import { afterEach, describe, expect, it } from 'vitest';
import { mintToken, Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';

type TokenArgs = { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } };
type RevokeArgs = { body: { accessToken: string | null; refreshToken: string | null }; response: void };

let manualBootCounter = 0;

/** A login/refresh-only provider on its own client, for tests that need control over the provider's `name`. */
const bootAuth = (s: Scenario, options: { accessTokenExpiresInMs?: number; refreshStrategy?: number } = {}) => {
  const id = ++manualBootCounter;
  const clientRef = createQueryClient({ name: `auth-features-client-${id}`, baseUrl: BASE_URL, keepUnusedFor: 0 });
  const post = createPostQuery(clientRef);
  const providerName = `auth-features-provider-${id}`;

  const authRef = createBearerAuthProvider({
    name: providerName,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', {
        queryCreator: post<TokenArgs>('/auth/refresh'),
        refreshStrategy: options.refreshStrategy ?? 0.5,
      }),
    ],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth-features scenario: failed to create the manual auth provider');

  return { providerName, auth, destroy: () => injector.destroy() };
};

/** A login/refresh/revoke provider with `withTokenRevocation` wired to the `revoke` query. */
const bootRevocationAuth = (s: Scenario) => {
  const id = ++manualBootCounter;
  const clientRef = createQueryClient({
    name: `auth-features-revocation-client-${id}`,
    baseUrl: BASE_URL,
    keepUnusedFor: 0,
  });
  const post = createPostQuery(clientRef);

  const authRef = createBearerAuthProvider({
    name: `auth-features-revocation-provider-${id}`,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', { queryCreator: post<TokenArgs>('/auth/refresh') }),
      withAuthenticationQuery('revoke', { queryCreator: post<RevokeArgs>('/auth/revoke') }),
    ],
    features: [withTokenRevocation({ queryKey: 'revoke', buildArgs: (tokens) => ({ body: tokens }) })],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth-features scenario: failed to create the revocation auth provider');

  return { auth, destroy: () => injector.destroy() };
};

const deleteCookie = () => {
  document.cookie = 'etAuth=; max-age=0; path=/';
};

describe('auth features without the devtools', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  afterEach(deleteCookie);

  it('caps a run of fresh-token 401s at three refreshes before falling back to minRefreshInterval', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth({ autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/me', () => ({ status: 401, body: { message: 'revoked' } }));

    const getSecureMe = createSecureGetQuery(s.clientRef, auth.ref)<{ response: { id: string } }>('/secure/me');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    const secureQuery = c.run(() => getSecureMe());

    // Each 401/refresh round arms its next timer one microtask after the last; flush() never awaits.
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
      s.tick(50);
    }

    expect(s.api.requestCount('GET', '/secure/me')).toBe(4);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(3);
    expect(secureQuery.error()?.code).toBe(401);
    expect(secureQuery.response()).toBeNull();
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.sessionStatus()).toBe('authenticated');

    for (let i = 0; i < 4; i++) {
      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
    }

    c.destroy();
  });

  it('withTokenRevocation calls the revocation query on logout() with the tokens it documents', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    s.api.on('POST', '/auth/login', () => ({
      body: { accessToken: mintToken(), refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));
    s.api.on('POST', '/auth/revoke', () => ({ status: 200 }));

    const { auth, destroy } = bootRevocationAuth(s);

    auth.queries.login.execute({ body: {} });
    s.tick();

    const accessTokenAtLogout = auth.accessToken();
    const refreshTokenAtLogout = auth.refreshToken();

    auth.logout();
    s.tick();

    const revokeRequest = s.api.requests.find((r) => r.path === '/auth/revoke');

    expect(revokeRequest?.body).toEqual({ accessToken: accessTokenAtLogout, refreshToken: refreshTokenAtLogout });
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('user');

    destroy();
  });

  it('the session still ends when the revocation request fails', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    s.api.on('POST', '/auth/login', () => ({
      body: { accessToken: mintToken(), refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));
    s.api.on('POST', '/auth/revoke', () => ({ status: 500, body: { message: 'boom' } }));

    const { auth, destroy } = bootRevocationAuth(s);

    auth.queries.login.execute({ body: {} });
    s.tick();

    auth.logout();
    s.flush();

    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('user');
    expect(auth.accessToken()).toBeNull();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);

    destroy();
  });

  it('withTokenExpirationWarning flips isExpiringSoon at the configured threshold and resets once a refresh lands', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const warning = withTokenExpirationWarning({ warningThreshold: 12000, checkInterval: 1000 });
    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: 0.5, features: [warning] });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(false);

    await s.settle(7000); // t=7000: still outside the 12s warning window
    expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(false);

    await s.settle(1000); // t=8000: 12s from the 20s expiry - the window opens
    expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(true);
    expect(auth.features.tokenExpirationWarning.expiresIn()).toBeLessThanOrEqual(12000);
    expect(auth.features.tokenExpirationWarning.expiresIn()).toBeGreaterThan(10000);

    await s.settle(3000);
    // The warning re-arms its timer one effect flush after the refresh lands; settle() advances once.
    s.tick();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(false);
    expect(auth.features.tokenExpirationWarning.expiresIn()).toBeGreaterThan(15000);

    c.destroy();
  });

  it('an anonymous visitor is redirected to the login URL with a return param, and an authenticated one passes through', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/dashboard' });

    router.resetConfig([
      { path: 'login', canMatch: [guard.canMatchAnonymous], children: [] },
      { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
    ]);

    await s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();
    expect(router.url).toBe('/login?returnUrl=%2Fdashboard');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();
    expect(router.url).toBe('/dashboard');

    c.destroy();
  });

  it('a guard pends while a session restore is in flight, so a reload of a protected URL lands there directly', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const persistentAuthFeature = () =>
      withPersistentAuth({ autoLogin: { queryKey: 'refresh', buildArgs: (token: string) => ({ body: { token } }) } });

    const seed = s.auth({ features: [persistentAuthFeature()] });
    const c = s.consumer();
    c.run(() => seed.queries.login.execute({ body: {} }));
    await s.settle();
    c.destroy();

    const auth = s.auth({ features: [persistentAuthFeature()] });

    expect(auth.sessionStatus()).toBe('restoring');

    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/dashboard' });

    router.resetConfig([
      { path: 'login', canMatch: [guard.canMatchAnonymous], children: [] },
      { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
    ]);

    const navigation = s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();
    await navigation;

    expect(router.url).toBe('/dashboard');
  });
});

describe('auth features with the devtools attached', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 }, providers: () => [provideQueryDevtools()] });

  afterEach(() => clearQueryDevtoolsTokenTtl());

  it('an armed token lifetime override refreshes early, and clearing it restores the real schedule', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(true);

    const { providerName, auth, destroy } = bootAuth(s, {
      accessTokenExpiresInMs: 20 * 60 * 1000,
      refreshStrategy: 0.5,
    });

    s.api.on('POST', '/auth/login', () => ({
      body: {
        accessToken: mintToken({ expiresInMs: 20 * 60 * 1000 }),
        refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
      },
    }));
    s.api.on('POST', '/auth/refresh', () => ({
      body: {
        accessToken: mintToken({ expiresInMs: 20 * 60 * 1000 }),
        refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
      },
    }));

    auth.queries.login.execute({ body: {} });
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    await s.settle(5000); // far short of the real ~600s schedule the 20-minute token would otherwise use

    setQueryDevtoolsTokenTtl({ providerName, seconds: 0 });
    await s.settle();

    expect(queryDevtoolsTokenTtls()[providerName]).toBe(0);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.sessionStatus()).toBe('authenticated');

    const tokenAfterOverrideRefresh = auth.accessToken();

    clearQueryDevtoolsTokenTtl(providerName);
    await s.settle();

    expect(queryDevtoolsTokenTtls()[providerName]).toBeUndefined();

    await s.settle(10000); // well under the real refresh buffer of the fresh (unoverridden) token

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.accessToken()).toBe(tokenAfterOverrideRefresh);

    destroy();
  });
});
