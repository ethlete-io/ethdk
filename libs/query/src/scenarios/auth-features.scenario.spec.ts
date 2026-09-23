import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, effect, EnvironmentInjector, inject } from '@angular/core';
import { RedirectCommand, Router } from '@angular/router';
import { isObservable } from 'rxjs';
import {
  BearerAuthSessionEndCause,
  clearQueryDevtoolsTokenTtl,
  createAuthGuard,
  createBearerAuthProvider,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  isQueryDevtoolsEnabled,
  provideQueryDevtools,
  queryDevtoolsEntries,
  queryDevtoolsTokenTtls,
  setQueryDevtoolsTokenTtl,
  withAuthenticationQuery,
  withBearerAuthMultiTabSync,
  withInactivityLogout,
  withPersistentAuth,
  withRefreshQuery,
  withTokenExpirationWarning,
  withTokenRevocation,
  withTracking,
} from '../index';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mintToken, Scenario, ScenarioAuthBuilders, useScenario } from './harness';

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

type SessionEndLogoutArgs = { response: void };

/**
 * A provider configured the way a consumer lib without `@angular/*` imports can: `bearer` puts the token on
 * the revocation request, and `revokeOn` picks the session end causes that call it.
 */
const bootBearerRevocationAuth = (
  s: Scenario,
  revocation: { bearer?: boolean; revokeOn?: readonly BearerAuthSessionEndCause[] },
  options: { inactivityTimeout?: number } = {},
) => {
  const id = ++manualBootCounter;
  const clientRef = createQueryClient({
    name: `auth-features-bearer-revocation-client-${id}`,
    baseUrl: BASE_URL,
    keepUnusedFor: 0,
  });
  const post = createPostQuery(clientRef);

  const authRef = createBearerAuthProvider({
    name: `auth-features-bearer-revocation-provider-${id}`,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', { queryCreator: post<TokenArgs>('/auth/refresh'), autoRetryOn401: true }),
      withAuthenticationQuery('logout', { queryCreator: post<SessionEndLogoutArgs>('/auth/logout') }),
    ],
    features: [
      withTokenRevocation({ queryKey: 'logout', ...revocation }),
      ...(options.inactivityTimeout ? [withInactivityLogout({ inactivityTimeout: options.inactivityTimeout })] : []),
    ],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth-features scenario: failed to create the bearer revocation auth provider');

  const getSecureMe = createSecureGetQuery(clientRef, authRef)<{ response: { id: string } }>('/secure/me');

  return { auth, getSecureMe, injector, destroy: () => injector.destroy() };
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

  it('a logout while a revoke runs sends no second revocation and leaves nothing loading', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    s.api.on('POST', '/auth/login', () => ({
      body: { accessToken: mintToken(), refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));
    s.api.on('POST', '/auth/revoke', () => ({ status: 200, delay: 1000 }));

    const { auth, destroy } = bootRevocationAuth(s);

    auth.queries.login.execute({ body: {} });
    s.tick();

    const tokens = { accessToken: auth.accessToken(), refreshToken: auth.refreshToken() };
    const running = auth.features.tokenRevocation.revoke();
    s.tick(100);

    expect(running?.isAlive()).toBe(true);

    auth.logout();
    s.tick();

    expect(auth.features.tokenRevocation.revoke()).toBe(running);

    await s.settle(1000);
    s.flush();

    expect(s.api.requests.filter((r) => r.path === '/auth/revoke').map((r) => r.body)).toEqual([tokens]);
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('user');
    expect(auth.executionState()?.state).not.toBe('loading');

    destroy();
  });

  it('revoke() with no tokens returns null and sends nothing', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    s.api.on('POST', '/auth/revoke', () => ({ status: 200 }));

    const { auth, destroy } = bootRevocationAuth(s);

    expect(auth.features.tokenRevocation.revoke()).toBeNull();
    s.flush();

    expect(s.api.requestCount('POST', '/auth/revoke')).toBe(0);
    expect(auth.executionState()).toBeNull();

    destroy();
  });

  it('a second revoke() while one runs returns the running snapshot', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    s.api.on('POST', '/auth/login', () => ({
      body: { accessToken: mintToken(), refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));
    s.api.on('POST', '/auth/revoke', () => ({ status: 200, delay: 1000 }));

    const { auth, destroy } = bootRevocationAuth(s);

    auth.queries.login.execute({ body: {} });
    s.tick();

    const first = auth.features.tokenRevocation.revoke();
    const second = auth.features.tokenRevocation.revoke();
    s.flush();

    expect(second).toBe(first);
    expect(s.api.requestCount('POST', '/auth/revoke')).toBe(1);

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

  it('reports the expiry from a custom expiration claim', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const eatToken = (expiresInMs: number) =>
      mintToken({ expiresInMs, claims: { exp: undefined, eat: Math.floor((Date.now() + expiresInMs) / 1000) } });

    s.api.on('POST', '/auth/login', () => ({
      body: { accessToken: eatToken(20000), refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));

    const warning = withTokenExpirationWarning({
      warningThreshold: 12000,
      checkInterval: 1000,
      expiresInPropertyName: 'eat',
    });
    const auth = s.auth({
      accessTokenExpiresInMs: 20000,
      refreshStrategy: 0.5,
      expiresInPropertyName: 'eat',
      features: [warning],
    });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.features.tokenExpirationWarning.expiresAt()).not.toBeNull();

    await s.settle(1000);

    expect(auth.features.tokenExpirationWarning.expiresIn()).toBeGreaterThan(18000);
    expect(auth.features.tokenExpirationWarning.expiresIn()).toBeLessThanOrEqual(19000);
    expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(false);

    await s.settle(7000);

    expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(true);

    c.destroy();
  });

  it('withTracking reports the cookie auto-login when trackInternalEvents is on', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const persistentAuthFeature = () =>
      withPersistentAuth<ScenarioAuthBuilders>({
        autoLogin: { queryKey: 'refresh', buildArgs: (token: string) => ({ body: { token } }) },
      });

    const seed = s.auth({ features: [persistentAuthFeature()] });
    const c = s.consumer();
    c.run(() => seed.queries.login.execute({ body: {} }));
    await s.settle();
    c.destroy();

    const events: string[] = [];
    const auth = s.auth({
      features: [
        persistentAuthFeature(),
        withTracking<ScenarioAuthBuilders>({
          trackInternalEvents: true,
          on: {
            refreshExecute: () => events.push('refreshExecute'),
            refreshSuccess: () => events.push('refreshSuccess'),
          },
        }),
      ],
    });

    await s.settle();

    expect(auth.isAuthenticated()).toBe(true);
    expect(events).toEqual(['refreshExecute', 'refreshSuccess']);
  });

  it('withTracking skips internal executions when trackInternalEvents is off', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const persistentAuthFeature = () =>
      withPersistentAuth<ScenarioAuthBuilders>({
        autoLogin: { queryKey: 'refresh', buildArgs: (token: string) => ({ body: { token } }) },
      });

    const seed = s.auth({ features: [persistentAuthFeature()] });
    const c = s.consumer();
    c.run(() => seed.queries.login.execute({ body: {} }));
    await s.settle();
    c.destroy();

    const events: string[] = [];
    const auth = s.auth({
      features: [
        persistentAuthFeature(),
        withTracking<ScenarioAuthBuilders>({
          trackInternalEvents: false,
          on: {
            refreshExecute: () => events.push('refreshExecute'),
            refreshSuccess: () => events.push('refreshSuccess'),
            loginSuccess: () => events.push('loginSuccess'),
          },
        }),
      ],
    });

    await s.settle();

    expect(auth.isAuthenticated()).toBe(true);
    expect(events).toEqual([]);

    const c2 = s.consumer();
    c2.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(events).toEqual(['loginSuccess']);

    c2.destroy();
  });

  it('a fractional refreshStrategy uses that fraction of the token lifetime, without the object form clamps', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: 0.5 });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    // mintToken's `exp` has second granularity, so the schedule lands anywhere in t=9000..10000.
    await s.settle(9000);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    await s.settle(1000);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    c.destroy();
  });

  it('a refreshStrategy above 1 is a fixed buffer in milliseconds before expiry', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: 5000 });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.settle(14000);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    await s.settle(1000);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    c.destroy();
  });

  it('the object form of refreshStrategy clamps the percentage buffer to minBufferMs', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth({ accessTokenExpiresInMs: 20000, refreshStrategy: { percentage: 0.5, minBufferMs: 15000 } });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.settle(4000);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    await s.settle(1000);
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

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
      withPersistentAuth<ScenarioAuthBuilders>({
        autoLogin: { queryKey: 'refresh', buildArgs: (token: string) => ({ body: { token } }) },
      });

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

  it('canActivate and canActivateAnonymous decide a route the same way canMatch does', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/dashboard' });

    router.resetConfig([
      { path: 'login', canActivate: [guard.canActivateAnonymous], children: [] },
      { path: 'dashboard', canActivate: [guard.canActivate], children: [] },
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

    await s.run(() => router.navigateByUrl('/login'));
    await s.settle();
    expect(router.url).toBe('/dashboard');

    c.destroy();
  });

  it('returnUrl() reads back the URL the guard captured, and is null when nothing was captured', async () => {
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

    expect(s.run(() => guard.returnUrl())).toBe('/dashboard');

    await s.run(() => router.navigateByUrl('/login'));
    await s.settle();

    expect(s.run(() => guard.returnUrl())).toBeNull();
  });

  it('navigateAfterLogin() navigates nowhere until subscribed, then lands on the captured URL', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/dashboard' });

    router.resetConfig([
      { path: 'login', canMatch: [guard.canMatchAnonymous], children: [] },
      { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
      { path: 'settings', children: [] },
    ]);

    await s.run(() => router.navigateByUrl('/settings'));
    await s.settle();
    await s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();

    expect(router.url).toBe('/login?returnUrl=%2Fdashboard');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const afterLogin$ = s.run(() => guard.navigateAfterLogin());
    await s.settle();

    expect(router.url).toBe('/login?returnUrl=%2Fdashboard');

    const subscription = afterLogin$.subscribe();
    await s.settle();

    expect(router.url).toBe('/dashboard');

    subscription.unsubscribe();
    c.destroy();
  });

  it('lands a login on / when defaultUrl is not configured and nothing was captured', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login' });

    router.resetConfig([
      { path: '', children: [] },
      { path: 'login', canMatch: [guard.canMatchAnonymous], children: [] },
    ]);

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.run(() => router.navigateByUrl('/login'));
    await s.settle();

    expect(router.url).toBe('/');

    c.destroy();
  });

  it('redirects to the login URL with no return param when returnUrlParam is false', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/dashboard', returnUrlParam: false });

    router.resetConfig([
      { path: 'login', canMatch: [guard.canMatchAnonymous], children: [] },
      { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
    ]);

    await s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();

    expect(router.url).toBe('/login');
    expect(s.run(() => guard.returnUrl())).toBeNull();
  });

  it('replaces the URL on a guard redirect, so the failed attempt leaves no history entry', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/dashboard' });

    router.resetConfig([
      { path: 'login', canMatch: [guard.canMatchAnonymous], children: [] },
      { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
    ]);

    const angularLocation = s.run(() => inject(Location));
    const go = vi.spyOn(angularLocation, 'go');
    const replaceState = vi.spyOn(angularLocation, 'replaceState');

    await s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();

    const pushed = go.mock.calls.length;
    const replaced = replaceState.mock.calls.length;

    go.mockRestore();
    replaceState.mockRestore();

    expect(router.url).toBe('/login?returnUrl=%2Fdashboard');
    expect(replaced).toBeGreaterThan(0);
    expect(pushed).toBe(0);
  });

  it('answers a guard synchronously when sessionStatus() is already anonymous', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/dashboard' });

    expect(auth.sessionStatus()).toBe('anonymous');

    const decision = s.run(() => (guard.canMatch as () => unknown)());

    expect(isObservable(decision)).toBe(false);
    expect(decision).toBeInstanceOf(RedirectCommand);
  });

  it('captures the attempted URL with its query params and fragment into the return param', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/dashboard' });

    router.resetConfig([
      { path: 'login', canMatch: [guard.canMatchAnonymous], children: [] },
      { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
    ]);

    await s.run(() => router.navigateByUrl('/dashboard?tab=2#section'));
    await s.settle();

    expect(router.url).toBe('/login?returnUrl=%2Fdashboard%3Ftab%3D2%23section');
    expect(s.run(() => guard.returnUrl())).toBe('/dashboard?tab=2#section');
  });

  it('discards an off-site returnUrl and navigates to defaultUrl instead', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/dashboard' });

    router.resetConfig([
      { path: 'login', canMatch: [guard.canMatchAnonymous], children: [] },
      { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
    ]);

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.run(() => router.navigateByUrl('/login?returnUrl=%2F%2Fevil.example'));
    await s.settle();

    expect(router.url).toBe('/dashboard');

    await s.run(() => router.navigateByUrl('/login?returnUrl=https%3A%2F%2Fevil.example'));
    await s.settle();

    expect(router.url).toBe('/dashboard');

    c.destroy();
  });

  it('reports the revocation query as executionState type revocation', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    s.api.on('POST', '/auth/login', () => ({
      body: { accessToken: mintToken(), refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));
    s.api.on('POST', '/auth/revoke', () => ({ status: 200 }));

    const { auth, destroy } = bootRevocationAuth(s);
    const types: string[] = [];

    s.run(() =>
      effect(() => {
        const state = auth.executionState();

        if (state) types.push(state.type);
      }),
    );

    auth.queries.login.execute({ body: {} });
    s.tick();

    auth.logout();
    s.flush();

    expect(types).toContain('revocation');
    expect(auth.sessionStatus()).toBe('anonymous');

    destroy();
  });

  it('throws when the same auth feature is passed twice', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const clientRef = createQueryClient({
      name: `auth-features-duplicate-client-${++manualBootCounter}`,
      baseUrl: BASE_URL,
      keepUnusedFor: 0,
    });
    const post = createPostQuery(clientRef);
    const authRef = createBearerAuthProvider({
      name: `auth-features-duplicate-provider-${manualBootCounter}`,
      queryClientRef: clientRef,
      queries: [
        withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
        withRefreshQuery('refresh', { queryCreator: post<TokenArgs>('/auth/refresh') }),
      ],
      features: [withTokenExpirationWarning(), withTokenExpirationWarning()] as unknown as readonly [],
    });

    const injector = createEnvironmentInjector(
      [...clientRef.provide(), ...authRef.provide()],
      s.run(() => inject(EnvironmentInjector)),
    );

    expect(() => injector.runInContext(() => authRef.inject())).toThrow(/ET203/);

    injector.destroy();
  });

  it('reads the expiry claim the refresh query names when withTokenExpirationWarning names none', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const eatToken = (expiresInMs: number) =>
      mintToken({ expiresInMs, claims: { exp: undefined, eat: Math.floor((Date.now() + expiresInMs) / 1000) } });

    s.api.on('POST', '/auth/login', () => ({
      body: { accessToken: eatToken(20000), refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));

    const warning = withTokenExpirationWarning({ warningThreshold: 12000, checkInterval: 1000 });
    const auth = s.auth({
      accessTokenExpiresInMs: 20000,
      refreshStrategy: 0.5,
      expiresInPropertyName: 'eat',
      features: [warning],
    });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.features.tokenExpirationWarning.expiresAt()).not.toBeNull();

    await s.settle(9000);

    expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(true);

    c.destroy();
  });

  it('flips isExpiringSoon five minutes before expiry by default', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    // A buffer of zero keeps the proactive refresh out of the way until long after the warning.
    const warning = withTokenExpirationWarning();
    const auth = s.auth({ accessTokenExpiresInMs: 20 * 60 * 1000, refreshStrategy: 1, features: [warning] });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(false);

    await s.settle(14 * 60 * 1000);

    expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(false);

    await s.settle(61 * 1000);

    expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(true);
    expect(auth.features.tokenExpirationWarning.expiresIn()).toBeLessThanOrEqual(5 * 60 * 1000);

    c.destroy();
  });

  it('logs out after the default 15 minute idle window, reset by any of the default activity events', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const inactivityLogout = withInactivityLogout<ScenarioAuthBuilders>();
    const auth = s.auth({ features: [inactivityLogout] });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    expect(auth.isAuthenticated()).toBe(true);

    for (const event of ['mousedown', 'keydown', 'scroll', 'touchstart']) {
      s.tick(14 * 60 * 1000);

      expect([event, auth.isAuthenticated()]).toEqual([event, true]);

      document.dispatchEvent(new Event(event));
      s.tick();
    }

    s.tick(15 * 60 * 1000 + 1);

    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('inactivity');

    c.destroy();
  });

  it('emits tracking events for a login, a refresh and a logout, with the logout carrying its cause', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const events: string[] = [];
    const auth = s.auth({
      accessTokenExpiresInMs: 20000,
      refreshStrategy: 0.5,
      features: [
        withTracking<ScenarioAuthBuilders>({
          on: {
            loginExecute: () => events.push('loginExecute'),
            loginSuccess: () => events.push('loginSuccess'),
            loginFailure: () => events.push('loginFailure'),
            tokenRefreshSuccess: ({ automatic }) => events.push(`tokenRefreshSuccess:${automatic}`),
            logout: ({ cause }) => events.push(`logout:${cause}`),
          },
        }),
      ],
    });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(events).toEqual(['loginExecute', 'loginSuccess']);

    await s.settle(10001);
    s.tick(1);

    expect(events).toEqual(['loginExecute', 'loginSuccess', 'tokenRefreshSuccess:true']);

    s.run(() => auth.logout('inactivity'));
    s.tick();

    expect(events).toEqual(['loginExecute', 'loginSuccess', 'tokenRefreshSuccess:true', 'logout:inactivity']);

    c.destroy();
  });

  it('reports a refresh the app starts itself as tokenRefreshSuccess { automatic: false }', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const events: boolean[] = [];
    const auth = s.auth({
      features: [
        withTracking<ScenarioAuthBuilders>({ on: { tokenRefreshSuccess: ({ automatic }) => events.push(automatic) } }),
      ],
    });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    c.run(() => auth.queries.refresh.execute({ body: {} }));
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(events).toEqual([false]);

    c.destroy();
  });

  it('polls customActivityCheck once a second and postpones the logout while it returns true', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    let isActive = true;
    let checks = 0;
    const inactivityLogout = withInactivityLogout<ScenarioAuthBuilders>({
      inactivityTimeout: 5000,
      customActivityCheck: () => {
        checks++;

        return isActive;
      },
    });
    const auth = s.auth({ features: [inactivityLogout] });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    s.tick(10000);

    expect(checks).toBe(10);
    expect(auth.isAuthenticated()).toBe(true);

    isActive = false;
    s.tick(5001);

    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('inactivity');

    c.destroy();
  });
});

describe('token revocation with bearer and revokeOn', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const logoutRequests = (s: Scenario) => s.api.requests.filter((r) => r.path === '/auth/logout');

  const login = (s: Scenario, auth: ReturnType<typeof bootBearerRevocationAuth>['auth']) => {
    s.api.on('POST', '/auth/login', () => ({
      body: { accessToken: mintToken(), refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));
    s.api.on('POST', '/auth/logout', () => ({ status: 204 }));

    auth.queries.login.execute({ body: {} });
    s.tick();

    return auth.accessToken();
  };

  it('bearer sends the revoked access token as the Authorization header of a query with no args', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const { auth, destroy } = bootBearerRevocationAuth(s, { bearer: true });
    const accessTokenAtLogout = login(s, auth);

    auth.logout();
    s.tick();

    expect(logoutRequests(s).map((r) => r.headers.get('Authorization'))).toEqual([`Bearer ${accessTokenAtLogout}`]);
    expect(auth.sessionStatus()).toBe('anonymous');

    destroy();
  });

  it('without bearer the revocation request carries no Authorization header', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const { auth, destroy } = bootBearerRevocationAuth(s, {});
    login(s, auth);

    auth.logout();
    s.tick();

    expect(logoutRequests(s).map((r) => r.headers.has('Authorization'))).toEqual([false]);

    destroy();
  });

  it("revokeOn: ['user'] revokes a logout() the user asked for", () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const { auth, destroy } = bootBearerRevocationAuth(s, { bearer: true, revokeOn: ['user'] });
    login(s, auth);

    auth.logout();
    s.tick();

    expect(auth.sessionEndCause()).toBe('user');
    expect(logoutRequests(s)).toHaveLength(1);

    destroy();
  });

  it("revokeOn: ['user'] does not revoke a session that expired after a failed refresh", () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const { auth, getSecureMe, injector, destroy } = bootBearerRevocationAuth(s, { bearer: true, revokeOn: ['user'] });
    login(s, auth);

    s.api.once('GET', '/secure/me', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.once('POST', '/auth/refresh', () => ({ status: 400, body: { message: 'refresh token revoked' } }));

    const c = s.consumer([], injector);
    c.run(() => getSecureMe());
    s.flush();

    expect(auth.sessionEndCause()).toBe('expired');
    expect(logoutRequests(s)).toHaveLength(0);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);

    c.destroy();
    destroy();
  });

  it("revokeOn: ['user'] does not revoke an inactivity logout", () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const { auth, destroy } = bootBearerRevocationAuth(
      s,
      { bearer: true, revokeOn: ['user'] },
      { inactivityTimeout: 5000 },
    );
    login(s, auth);

    s.tick(5000);

    expect(auth.sessionEndCause()).toBe('inactivity');
    expect(logoutRequests(s)).toHaveLength(0);

    destroy();
  });

  it("revokeOn: ['user'] does not revoke the logout another tab carried here", () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const { auth, destroy } = bootBearerRevocationAuth(s, { bearer: true, revokeOn: ['user'] });
    login(s, auth);

    auth.logout('otherTab');
    s.tick();

    expect(logoutRequests(s)).toHaveLength(0);

    destroy();
  });

  it("revokeOn: ['expired', 'inactivity'] revokes an inactivity logout but not a user logout", () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const idle = bootBearerRevocationAuth(
      s,
      { bearer: true, revokeOn: ['expired', 'inactivity'] },
      { inactivityTimeout: 5000 },
    );
    const accessTokenAtTimeout = login(s, idle.auth);

    s.tick(5000);

    expect(logoutRequests(s).map((r) => r.headers.get('Authorization'))).toEqual([`Bearer ${accessTokenAtTimeout}`]);

    idle.destroy();

    const user = bootBearerRevocationAuth(s, { bearer: true, revokeOn: ['expired', 'inactivity'] });
    login(s, user.auth);

    user.auth.logout();
    s.tick();

    expect(logoutRequests(s)).toHaveLength(1);

    user.destroy();
  });
});

describe('inactivity logout and tracking controls', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('disable() holds the logout off and reports no countdown, and enable() restarts the full window', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth({ features: [withInactivityLogout<ScenarioAuthBuilders>({ inactivityTimeout: 10_000 })] });
    const inactivity = auth.features.inactivityLogout;

    expect(inactivity.calculateTimeUntilLogout()).toBeNull();

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    expect(inactivity.calculateTimeUntilLogout()).toBe(10_000);

    inactivity.disable();
    s.tick();

    expect(inactivity.enabled()).toBe(false);
    expect(inactivity.calculateTimeUntilLogout()).toBeNull();

    s.tick(30_000);

    expect(auth.isAuthenticated()).toBe(true);

    inactivity.enable();
    s.tick();

    expect(inactivity.enabled()).toBe(true);
    expect(inactivity.calculateTimeUntilLogout()).toBe(10_000);

    s.tick(9_000);

    expect(auth.isAuthenticated()).toBe(true);

    s.tick(1_001);

    expect(auth.sessionEndCause()).toBe('inactivity');
    expect(inactivity.calculateTimeUntilLogout()).toBeNull();

    c.destroy();
  });

  it('fires every handler registered for an event, and an unsubscribe removes only its own', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth({ features: [withTracking<ScenarioAuthBuilders>()] });
    const tracking = auth.features.tracking;
    const events: string[] = [];
    const first = () => events.push('first');
    const second = () => events.push('second');

    tracking.off('logout', first);
    const unsubscribeFirst = tracking.on('logout', first);
    tracking.on('logout', second);

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    s.run(() => auth.logout());
    s.tick();

    expect(events).toEqual(['first', 'second']);

    unsubscribeFirst();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    s.run(() => auth.logout());
    s.tick();

    expect(events).toEqual(['first', 'second', 'second']);

    tracking.off('logout', second);
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    s.run(() => auth.logout());
    s.tick();

    expect(events).toEqual(['first', 'second', 'second']);

    c.destroy();
  });

  it('reports a failed login once as loginFailure with the error, and the next attempt from Execute on', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const events: string[] = [];
    const auth = s.auth({
      features: [
        withTracking<ScenarioAuthBuilders>({
          on: {
            loginExecute: () => events.push('loginExecute'),
            loginSuccess: () => events.push('loginSuccess'),
            loginFailure: ({ error }) => events.push(`loginFailure:${error.code}`),
          },
        }),
      ],
    });
    s.api.once('POST', '/auth/login', () => ({ status: 401, body: { message: 'bad credentials' } }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    await s.settle(1000);

    expect(events).toEqual(['loginExecute', 'loginFailure:401']);

    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(events).toEqual(['loginExecute', 'loginFailure:401', 'loginExecute', 'loginSuccess']);
    expect(auth.isAuthenticated()).toBe(true);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);

    c.destroy();
  });
});

describe('auth guard targets and a pending restore', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  afterEach(deleteCookie);

  it('accepts a command array, a UrlTree and a (router) => UrlTree as its login and default URLs', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const router = s.run(() => inject(Router));
    const arrayGuard = createAuthGuard(auth.ref, { loginUrl: ['/sign-in', 'array'], defaultUrl: ['/home', 'array'] });
    const treeGuard = createAuthGuard(auth.ref, {
      loginUrl: router.parseUrl('/sign-in/tree'),
      defaultUrl: router.parseUrl('/home/tree'),
    });
    const fnGuard = createAuthGuard(auth.ref, {
      loginUrl: (r) => r.createUrlTree(['/sign-in', 'fn']),
      defaultUrl: (r) => r.createUrlTree(['/home', 'fn']),
    });

    router.resetConfig([
      { path: 'sign-in/:kind', children: [] },
      { path: 'home/:kind', children: [] },
      { path: 'array', canMatch: [arrayGuard.canMatch], children: [] },
      { path: 'tree', canMatch: [treeGuard.canMatch], children: [] },
      { path: 'fn', canMatch: [fnGuard.canMatch], children: [] },
      { path: 'login-array', canMatch: [arrayGuard.canMatchAnonymous], children: [] },
      { path: 'login-tree', canMatch: [treeGuard.canMatchAnonymous], children: [] },
      { path: 'login-fn', canMatch: [fnGuard.canMatchAnonymous], children: [] },
    ]);

    for (const kind of ['array', 'tree', 'fn']) {
      await s.run(() => router.navigateByUrl(`/${kind}`));
      await s.settle();

      expect(router.url).toBe(`/sign-in/${kind}?returnUrl=%2F${kind}`);
    }

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    for (const kind of ['array', 'tree', 'fn']) {
      await s.run(() => router.navigateByUrl(`/login-${kind}`));
      await s.settle();

      expect(router.url).toBe(`/home/${kind}`);
    }

    c.destroy();
  });

  it('navigateAfterLogin() lands on / when neither a return URL nor defaultUrl is there', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const auth = s.auth();
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login' });

    router.resetConfig([
      { path: '', children: [] },
      { path: 'login', children: [] },
    ]);

    await s.run(() => router.navigateByUrl('/login'));
    await s.settle();

    const subscription = s.run(() => guard.navigateAfterLogin()).subscribe();
    await s.settle();

    expect(router.url).toBe('/');

    subscription.unsubscribe();
  });

  it('holds a navigation for as long as a slow session restore runs, then lets it through', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const persistentAuthFeature = () =>
      withPersistentAuth<ScenarioAuthBuilders>({
        autoLogin: { queryKey: 'refresh', buildArgs: (token: string) => ({ body: { token } }) },
      });

    const seed = s.auth({ features: [persistentAuthFeature()] });
    const c = s.consumer();
    c.run(() => seed.queries.login.execute({ body: {} }));
    await s.settle();
    c.destroy();

    s.api.once('POST', '/auth/refresh', () => ({
      delay: 5000,
      body: {
        accessToken: mintToken({ expiresInMs: 15 * 60 * 1000 }),
        refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
      },
    }));

    const auth = s.auth({ features: [persistentAuthFeature()] });
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login' });

    router.resetConfig([
      { path: 'login', children: [] },
      { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
    ]);

    let landed: boolean | null = null;
    void s.run(() => router.navigateByUrl('/dashboard')).then((result) => (landed = result));
    await s.settle(1000);

    expect(auth.sessionStatus()).toBe('restoring');
    expect(landed).toBeNull();
    expect(router.url).toBe('/');

    await s.settle(4000);
    await s.settle();

    expect(auth.sessionStatus()).toBe('authenticated');
    expect(landed).toBe(true);
    expect(router.url).toBe('/dashboard');
  });

  it('drops the wait of a guard whose navigation another one superseded', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const persistentAuthFeature = () =>
      withPersistentAuth<ScenarioAuthBuilders>({
        autoLogin: { queryKey: 'refresh', buildArgs: (token: string) => ({ body: { token } }) },
      });

    const seed = s.auth({ features: [persistentAuthFeature()] });
    const c = s.consumer();
    c.run(() => seed.queries.login.execute({ body: {} }));
    await s.settle();
    c.destroy();

    s.api.once('POST', '/auth/refresh', () => ({ delay: 5000, status: 401, body: { message: 'unauthorized' } }));

    const auth = s.auth({ features: [persistentAuthFeature()] });
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login' });

    router.resetConfig([
      { path: 'login', children: [] },
      { path: 'public', children: [] },
      { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
    ]);

    let landed: boolean | null = null;
    void s.run(() => router.navigateByUrl('/dashboard')).then((result) => (landed = result));
    await s.settle(1000);

    await s.run(() => router.navigateByUrl('/public'));
    await s.settle();

    expect(landed).toBe(false);
    expect(router.url).toBe('/public');

    await s.settle(5000);

    expect(auth.sessionStatus()).toBe('anonymous');
    expect(router.url).toBe('/public');
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
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

  const featureDetailsOf = (auth: object, type: string) =>
    queryDevtoolsEntries()
      .find((entry) => entry.kind === 'auth-provider' && entry.handle === auth)
      ?.meta.features?.find((feature) => feature.type === type)?.details;

  it('describes the inactivity logout of a lone tab and of a tab that shares idleness with its siblings', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(true);

    const lone = s.auth({ features: [withInactivityLogout<ScenarioAuthBuilders>()] });
    const shared = s.auth({
      features: [
        withBearerAuthMultiTabSync(),
        withInactivityLogout<ScenarioAuthBuilders>({
          inactivityTimeout: 90_000,
          activityEvents: ['keydown'],
          customActivityCheck: () => false,
        }),
      ],
    });
    s.tick();

    expect(featureDetailsOf(lone, 'INACTIVITY_LOGOUT')).toEqual([
      { label: 'timeout', value: '15m' },
      { label: 'activity events', value: 'mousedown, keydown, scroll, touchstart' },
      { label: 'idleness', value: 'this tab only' },
    ]);
    expect(featureDetailsOf(shared, 'INACTIVITY_LOGOUT')).toEqual([
      { label: 'timeout', value: '1.5m' },
      { label: 'activity events', value: 'keydown' },
      { label: 'idleness', value: 'shared across tabs' },
      { label: 'custom activity check', value: 'yes' },
    ]);
  });

  it('describes whether tracking hears internal executions and which handlers it was given', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(true);

    const bare = s.auth({ features: [withTracking<ScenarioAuthBuilders>()] });
    const configured = s.auth({
      features: [
        withTracking<ScenarioAuthBuilders>({
          trackInternalEvents: false,
          on: { loginSuccess: () => undefined, logout: () => undefined },
        }),
      ],
    });
    s.tick();

    expect(featureDetailsOf(bare, 'TRACKING')).toEqual([{ label: 'internal events', value: 'tracked' }]);
    expect(featureDetailsOf(configured, 'TRACKING')).toEqual([
      { label: 'internal events', value: 'ignored' },
      { label: 'handlers', value: 'loginSuccess, logout' },
    ]);
  });
});
