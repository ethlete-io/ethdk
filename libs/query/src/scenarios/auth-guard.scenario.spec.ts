import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthGuardConfig, createAuthGuard, withPersistentAuth } from '../index';
import { mintToken, Scenario, ScenarioAuthBuilders, useScenario } from './harness';

type Role = { role?: string };

const deleteCookie = () => {
  document.cookie = 'etAuth=; max-age=0; path=/';
};

const persistentAuth = () => withPersistentAuth<ScenarioAuthBuilders>({ autoLogin: { queryKey: 'refresh' } });

/** Leaves a remember-me cookie behind, as a previous page load that signed in does. */
const seedCookie = async (s: Scenario) => {
  const seed = s.auth({ features: [persistentAuth()] });
  const c = s.consumer();

  c.run(() => seed.queries.login.execute({ body: {} }));
  await s.settle();
  c.destroy();
};

const routeTo = (
  s: Scenario,
  auth: { ref: Parameters<typeof createAuthGuard>[0] },
  config?: Partial<AuthGuardConfig>,
) => {
  const router = s.run(() => inject(Router));
  const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/home', ...config });

  router.resetConfig([
    { path: 'login', canMatch: [guard.canMatchAnonymous], children: [] },
    { path: 'home', children: [] },
    { path: 'public', children: [] },
    { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
  ]);

  return { router, guard };
};

const isNetworkError = (entry: { error: unknown }) =>
  entry.error instanceof HttpErrorResponse && entry.error.status === 0;

describe('auth guard', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  afterEach(deleteCookie);

  it('stops waiting for a restore that does not answer after restoreTimeoutMs and sends the visitor to the login', async () => {
    const s = scenario();

    await seedCookie(s);
    s.api.once('POST', '/auth/refresh', () => ({
      body: { accessToken: mintToken(), refreshToken: mintToken({ expiresInMs: 3600000 }) },
      delay: 60000,
    }));

    const auth = s.auth({ features: [persistentAuth()] });
    const { router } = routeTo(s, auth, { restoreTimeoutMs: 5000 });

    void s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();
    await s.settle(4900);

    expect(auth.sessionStatus()).toBe('restoring');
    expect(router.url).toBe('/');

    await s.settle(100);
    await s.settle();

    expect(router.url).toBe('/login?returnUrl=%2Fdashboard');

    await s.settle(60000);
  });

  it('gives a restore that only meets network errors up after a bounded number of retries', async () => {
    const s = scenario();

    await seedCookie(s);
    for (let i = 0; i < 12; i++) s.api.once('POST', '/auth/refresh', () => ({ status: 0 }));

    const auth = s.auth({ features: [persistentAuth()] });

    for (let i = 0; i < 30; i++) await s.settle(10000);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(9);
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBeNull();

    s.expectError(isNetworkError);
  });

  it('canMatchWith lets in a session the permission accepts, and sends one it rejects to the default URL', async () => {
    const s = scenario();

    let role = 'editor';

    s.api.on('POST', '/auth/login', () => ({
      body: { accessToken: mintToken({ claims: { role } }), refreshToken: mintToken({ expiresInMs: 3600000 }) },
    }));

    const auth = s.auth<[], Role>();
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(auth.ref, { loginUrl: '/login', defaultUrl: '/home' });

    router.resetConfig([
      { path: 'login', children: [] },
      { path: 'home', children: [] },
      {
        path: 'admin',
        canMatch: [guard.canMatchWith((provider) => provider.bearerData()?.role === 'admin')],
        children: [],
      },
      {
        path: 'reports',
        canMatch: [guard.canMatchWith(() => false, { redirectTo: '/forbidden' })],
        children: [],
      },
      { path: 'forbidden', children: [] },
    ]);

    await s.run(() => router.navigateByUrl('/admin'));
    await s.settle();
    expect(router.url).toBe('/login?returnUrl=%2Fadmin');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.run(() => router.navigateByUrl('/admin'));
    await s.settle();
    expect(router.url).toBe('/home');

    await s.run(() => router.navigateByUrl('/reports'));
    await s.settle();
    expect(router.url).toBe('/forbidden');

    role = 'admin';
    auth.logout();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.run(() => router.navigateByUrl('/admin'));
    await s.settle();
    expect(router.url).toBe('/admin');

    c.destroy();
  });

  it('redirectOnSessionEnd sends a visitor on a protected route to the login when the session ends for a listed cause', async () => {
    const s = scenario();

    const auth = s.auth();
    const { router } = routeTo(s, auth, { redirectOnSessionEnd: ['expired', 'inactivity', 'otherTab'] });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();
    expect(router.url).toBe('/dashboard');

    auth.logout('expired');
    await s.settle();
    await s.settle();

    expect(router.url).toBe('/login?returnUrl=%2Fdashboard');

    c.destroy();
  });

  it('redirectOnSessionEnd leaves a deliberate logout, an unlisted cause and an unprotected route where they are', async () => {
    const s = scenario();

    const auth = s.auth();
    const { router } = routeTo(s, auth, { redirectOnSessionEnd: ['expired'] });

    const c = s.consumer();
    const signIn = async () => {
      c.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();
    };

    await signIn();
    await s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();

    auth.logout();
    await s.settle();
    expect(router.url).toBe('/dashboard');

    await signIn();
    auth.logout('inactivity');
    await s.settle();
    expect(router.url).toBe('/dashboard');

    await signIn();
    await s.run(() => router.navigateByUrl('/public'));
    await s.settle();
    auth.logout('expired');
    await s.settle();
    expect(router.url).toBe('/public');

    c.destroy();
  });

  it('redirects nothing when a session ends without redirectOnSessionEnd', async () => {
    const s = scenario();

    const auth = s.auth();
    const { router } = routeTo(s, auth);

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    await s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();

    auth.logout('expired');
    await s.settle();

    expect(router.url).toBe('/dashboard');

    c.destroy();
  });
});
