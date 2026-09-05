import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, inject } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { isObservable, Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BearerAuthProviderFeatureContext,
  createAuthGuard,
  createBearerAuthProvider,
  createPostQuery,
  createQueryClient,
  withAuthenticationQuery,
  withPersistentAuth,
  withRefreshQuery,
} from '../index';
import { mintToken, Scenario, ScenarioAuthBuilders, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const PROVIDER_NAME = 'auth-persistent-scenario';
const COOKIE_NAME = 'etAuth';

type TokenArgs = { body: { token?: string }; response: { accessToken: string; refreshToken: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFeatureBuilder = (context: BearerAuthProviderFeatureContext<any, any>) => { type: string; instance: unknown };

type PersistentAuthFeatureRegistry = {
  persistentAuth: {
    rememberMe: () => boolean;
    setRememberMe: (enabled: boolean) => void;
    tryLogin: () => void;
  };
};

type BootOptions = {
  features?: readonly AnyFeatureBuilder[];
};

let bootCounter = 0;

const is401 = (entry: { error: unknown }) => entry.error instanceof HttpErrorResponse && entry.error.status === 401;

const serve = (s: Scenario, accessTokenExpiresInMs = 15 * 60 * 1000) => {
  const pair = () => ({
    accessToken: mintToken({ expiresInMs: accessTokenExpiresInMs }),
    refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
  });

  s.api.on('POST', '/auth/login', () => ({ body: pair() }));
  s.api.on('POST', '/auth/refresh', () => ({ body: pair() }));
};

/** One browser tab, or one page load: its own query client and auth provider on the scenario's fake API. */
const boot = (s: Scenario, options: BootOptions = {}) => {
  const clientRef = createQueryClient({
    name: `auth-persistent-client-${++bootCounter}`,
    baseUrl: BASE_URL,
    keepUnusedFor: 0,
  });
  const post = createPostQuery(clientRef);
  const authRef = createBearerAuthProvider({
    name: PROVIDER_NAME,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', {
        queryCreator: post<TokenArgs>('/auth/refresh'),
        refreshStrategy: 0.5,
      }),
    ],
    features: (options.features ?? []) as unknown as readonly [],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth persistent scenario: failed to create the auth provider');

  return {
    auth,
    authRef,
    injector,
    destroy: () => injector.destroy(),
  };
};

type Tab = ReturnType<typeof boot>;

const login = async (s: Scenario, tab: Tab) => {
  tab.auth.queries.login.execute({ body: {} });
  await s.settle();
};

const persistentAuth = (overrides: { excludeRoutes?: string[]; shouldAutoLogin?: (url: string) => boolean } = {}) =>
  withPersistentAuth<ScenarioAuthBuilders>({
    autoLogin: {
      queryKey: 'refresh',
      buildArgs: (token: string) => ({ body: { token } }),
      ...overrides,
    },
  });

const persistentFeatureOf = (auth: Tab['auth']) =>
  (auth.features as unknown as PersistentAuthFeatureRegistry).persistentAuth;

const hasCookie = () => document.cookie.includes(`${COOKIE_NAME}=`);

const navigateTo = async (s: Scenario, url: string) => {
  const router = s.run(() => inject(Router));

  await router.navigateByUrl(url);
  await s.settle();
};

describe('withPersistentAuth', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    providers: () => [provideRouter([{ path: '**', children: [] }])],
  });

  beforeEach(() => {
    document.cookie = `${COOKIE_NAME}=; max-age=0; path=/`;
    localStorage.removeItem(`${COOKIE_NAME}-rememberMe`);
  });

  it('a cookie the server rejects ends the session as expired and deletes the cookie; the next load starts anonymous and sends no request', async () => {
    const s = scenario();

    serve(s, 20000);

    const first = boot(s, { features: [persistentAuth()] });
    await login(s, first);
    first.destroy();

    expect(hasCookie()).toBe(true);

    s.api.once('POST', '/auth/refresh', () => ({ status: 401, body: { message: 'expired' } }));

    const second = boot(s, { features: [persistentAuth()] });
    await s.settle();
    s.flush();
    s.expectError(is401);

    expect(second.auth.sessionEndCause()).toBe('expired');
    expect(hasCookie()).toBe(false);
    second.destroy();

    const requestsBeforeReload = s.api.requests.length;
    const third = boot(s, { features: [persistentAuth()] });
    await s.settle();
    s.flush();

    expect(third.auth.sessionStatus()).toBe('anonymous');
    expect(s.api.requests.slice(requestsBeforeReload)).toEqual([]);

    third.destroy();
  });

  it('logout deletes the cookie', async () => {
    const s = scenario();

    serve(s);

    const tab = boot(s, { features: [persistentAuth()] });
    await login(s, tab);

    expect(hasCookie()).toBe(true);

    tab.auth.logout();
    await s.settle();

    expect(hasCookie()).toBe(false);

    tab.destroy();
  });

  it('a refresh that fails with a 500 keeps the cookie and the session, and can still recover', async () => {
    const s = scenario();

    serve(s, 20000);

    const first = boot(s, { features: [persistentAuth()] });
    await login(s, first);
    first.destroy();

    const cookieBefore = document.cookie;

    s.api.once('POST', '/auth/refresh', () => ({ status: 500 }));

    const second = boot(s, { features: [persistentAuth()] });
    await s.settle();

    expect(document.cookie).toBe(cookieBefore);
    expect(second.auth.sessionEndCause()).toBeNull();
    expect(second.auth.sessionStatus()).toBe('restoring');

    await s.settle(2100);

    expect(second.auth.sessionStatus()).toBe('authenticated');

    second.destroy();
  });

  it('a network error keeps the cookie and the session, and can still recover', async () => {
    const s = scenario();

    serve(s, 20000);

    const first = boot(s, { features: [persistentAuth()] });
    await login(s, first);
    first.destroy();

    const cookieBefore = document.cookie;

    s.api.once('POST', '/auth/refresh', () => ({ status: 0 }));

    const second = boot(s, { features: [persistentAuth()] });
    await s.settle();

    expect(document.cookie).toBe(cookieBefore);
    expect(second.auth.sessionEndCause()).toBeNull();
    expect(second.auth.sessionStatus()).toBe('restoring');

    await s.settle(2100);

    expect(second.auth.sessionStatus()).toBe('authenticated');

    second.destroy();
  });

  it('excludeRoutes vetoes auto-login on a matching route and not on another', async () => {
    const s = scenario();

    serve(s);

    const first = boot(s, { features: [persistentAuth()] });
    await login(s, first);
    first.destroy();

    await navigateTo(s, '/login');

    const excluded = boot(s, { features: [persistentAuth({ excludeRoutes: ['/login'] })] });
    await s.settle();
    s.flush();

    expect(excluded.auth.sessionStatus()).toBe('anonymous');
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    excluded.destroy();

    await navigateTo(s, '/dashboard');

    const included = boot(s, { features: [persistentAuth({ excludeRoutes: ['/login'] })] });
    await s.settle();
    s.flush();

    expect(included.auth.sessionStatus()).toBe('authenticated');
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    included.destroy();
  });

  it('shouldAutoLogin vetoes auto-login independently of excludeRoutes', async () => {
    const s = scenario();

    serve(s);

    const first = boot(s, { features: [persistentAuth()] });
    await login(s, first);
    first.destroy();

    await navigateTo(s, '/blocked');

    const blocked = boot(s, { features: [persistentAuth({ shouldAutoLogin: (url) => url !== '/blocked' })] });
    await s.settle();
    s.flush();

    expect(blocked.auth.sessionStatus()).toBe('anonymous');
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    blocked.destroy();

    await navigateTo(s, '/dashboard');

    const allowed = boot(s, { features: [persistentAuth({ shouldAutoLogin: (url) => url !== '/blocked' })] });
    await s.settle();
    s.flush();

    expect(allowed.auth.sessionStatus()).toBe('authenticated');
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    allowed.destroy();
  });

  it('setRememberMe(false) writes a session cookie with no expiry', async () => {
    const s = scenario();

    serve(s);

    const tab = boot(s, { features: [persistentAuth()] });
    persistentFeatureOf(tab.auth).setRememberMe(false);

    const setSpy = vi.spyOn(document, 'cookie', 'set');

    await login(s, tab);

    const write = setSpy.mock.calls
      .map((call) => call[0] as string)
      .find((value) => value.startsWith(`${COOKIE_NAME}=`));
    setSpy.mockRestore();

    tab.destroy();

    expect(write).toBeDefined();
    expect(write).not.toMatch(/expires=/i);
  });

  it('setRememberMe(true) writes a persistent cookie with an expiry', async () => {
    const s = scenario();

    serve(s);

    const tab = boot(s, { features: [persistentAuth()] });
    persistentFeatureOf(tab.auth).setRememberMe(true);

    const setSpy = vi.spyOn(document, 'cookie', 'set');

    await login(s, tab);

    const write = setSpy.mock.calls
      .map((call) => call[0] as string)
      .find((value) => value.startsWith(`${COOKIE_NAME}=`));
    setSpy.mockRestore();

    tab.destroy();

    expect(write).toBeDefined();
    expect(write).toMatch(/expires=/i);
  });
  it('a login that fails while the cookie restore is still out leaves the session anonymous, not restoring', async () => {
    const s = scenario();

    serve(s, 20000);

    const first = boot(s, { features: [persistentAuth()] });
    await login(s, first);
    first.destroy();

    s.api.once('POST', '/auth/refresh', () => ({ status: 401, body: { message: 'expired' }, delay: 1000 }));
    s.api.once('POST', '/auth/login', () => ({ status: 401, body: { message: 'rejected' }, delay: 200 }));

    const second = boot(s, { features: [persistentAuth()] });
    await s.settle();

    expect(second.auth.sessionStatus()).toBe('restoring');

    second.auth.queries.login.execute({ body: {} });
    await s.settle();
    await s.settle(2000);
    s.flush();
    s.expectError(is401);
    s.expectError(is401);

    const guard = createAuthGuard(second.authRef, { loginUrl: '/login' });
    const decision = second.injector.runInContext(() => (guard.canMatch as () => unknown)());
    let settled = !isObservable(decision);

    if (isObservable(decision)) {
      (decision as Observable<unknown>).subscribe(() => (settled = true));
      s.flush();
    }

    expect(second.auth.sessionStatus()).toBe('anonymous');
    expect(second.auth.executionState()?.state).not.toBe('loading');
    expect(settled).toBe(true);

    second.destroy();
  });

  it('a login that succeeds while the cookie restore is still out leaves the session authenticated', async () => {
    const s = scenario();

    serve(s, 20000);

    const first = boot(s, { features: [persistentAuth()] });
    await login(s, first);
    first.destroy();

    s.api.once('POST', '/auth/refresh', () => ({ status: 401, body: { message: 'expired' }, delay: 1000 }));
    s.api.once('POST', '/auth/login', () => ({
      body: {
        accessToken: mintToken({ expiresInMs: 20000 }),
        refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
      },
      delay: 200,
    }));

    const second = boot(s, { features: [persistentAuth()] });
    await s.settle();

    expect(second.auth.sessionStatus()).toBe('restoring');

    second.auth.queries.login.execute({ body: {} });
    await s.settle();
    await s.settle(2000);
    s.flush();
    s.expectError(is401);

    expect(second.auth.sessionStatus()).toBe('authenticated');
    expect(second.auth.sessionEndCause()).toBeNull();
    expect(second.auth.executionState()).toEqual(expect.objectContaining({ type: 'login', state: 'success' }));

    second.destroy();
  });
});
