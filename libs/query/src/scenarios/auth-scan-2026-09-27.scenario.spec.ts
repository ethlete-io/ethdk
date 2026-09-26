import { createEnvironmentInjector, EnvironmentInjector, inject, PLATFORM_ID, Provider } from '@angular/core';
import { Router } from '@angular/router';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BearerAuthSessionEndCause,
  createAuthGuard,
  createBearerAuthProvider,
  createPostQuery,
  createQueryClient,
  withAuthenticationQuery,
  withBearerAuthMultiTabSync,
  withRefreshQuery,
  withTokenRevocation,
} from '../index';
import { mintToken, Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';

type TokenArgs = { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } };
type RevokeArgs = {
  body: { accessToken: string | null; refreshToken: string | null };
  response: { ok: boolean };
};

let counter = 0;

type TabOptions = {
  name?: string;
  multiTab?: boolean;
  revokeOn?: readonly BearerAuthSessionEndCause[];
  providers?: Provider[];
  inRoot?: boolean;
};

const createTab = (s: Scenario, options: TabOptions = {}) => {
  const id = ++counter;
  const clientRef = createQueryClient({ name: `auth-scan-client-${id}`, baseUrl: BASE_URL, keepUnusedFor: 0 });
  const post = createPostQuery(clientRef);

  const queries = [
    withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
    withRefreshQuery('refresh', { queryCreator: post<TokenArgs>('/auth/refresh') }),
    withAuthenticationQuery('revoke', { queryCreator: post<RevokeArgs>('/auth/revoke') }),
  ] as const;

  const revocation = withTokenRevocation<typeof queries>({
    queryKey: 'revoke',
    buildArgs: (tokens) => ({ body: tokens }),
    revokeOn: options.revokeOn,
  });

  const authRef = createBearerAuthProvider({
    name: options.name ?? `auth-scan-provider-${id}`,
    queryClientRef: clientRef,
    queries,
    features: (options.multiTab
      ? [revocation, withBearerAuthMultiTabSync<typeof queries>()]
      : [revocation]) as unknown as readonly [typeof revocation, ReturnType<typeof withBearerAuthMultiTabSync>],
  });

  if (options.inRoot) {
    const auth = s.run(() => authRef.inject());

    return { auth, authRef, destroy: () => undefined };
  }

  const injector = createEnvironmentInjector(
    [...(options.providers ?? []), ...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth scan scenario: failed to create the auth provider');

  return { auth, authRef, destroy: () => injector.destroy() };
};

const issueTokens = () => ({
  body: { accessToken: mintToken(), refreshToken: mintToken({ expiresInMs: 3600000 }) },
});

const sync = async (s: Scenario) => {
  for (let round = 0; round < 3; round++) {
    await s.settle();
    await flushMultiTabSync();
  }
};

describe('auth scan 2026-09-27', () => {
  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  it('redirectOnSessionEnd redirects on a logout that withTokenRevocation revokes', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens);
    s.api.on('POST', '/auth/revoke', () => ({ body: { ok: true } }));

    const tab = createTab(s, { inRoot: true });
    const router = s.run(() => inject(Router));
    const guard = createAuthGuard(tab.authRef, { loginUrl: '/login', redirectOnSessionEnd: ['expired'] });

    router.resetConfig([
      { path: 'login', children: [] },
      { path: 'dashboard', canMatch: [guard.canMatch], children: [] },
    ]);

    tab.auth.queries.login.execute({ body: {} });
    await s.settle();

    await s.run(() => router.navigateByUrl('/dashboard'));
    await s.settle();
    expect(router.url).toBe('/dashboard');

    tab.auth.logout('expired');
    await s.settle();
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/revoke')).toBe(1);
    expect(router.url).toBe('/login?returnUrl=%2Fdashboard');

    tab.destroy();
  });

  it('a logout while the previous revocation is in flight still revokes the new pair', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens);
    s.api.on('POST', '/auth/revoke', () => ({ body: { ok: true }, delay: 1000 }));

    const { auth, destroy } = createTab(s);
    const signInAndOut = () => {
      auth.queries.login.execute({ body: {} });
      s.tick();

      const pair = { accessToken: auth.accessToken(), refreshToken: auth.refreshToken() };

      auth.logout();
      s.tick();

      return pair;
    };

    const first = signInAndOut();
    const second = signInAndOut();

    expect(second).not.toEqual(first);

    await s.settle(1000);
    await s.settle(1000);
    await s.settle();

    expect(s.api.requests.filter((r) => r.path === '/auth/revoke').map((r) => r.body)).toEqual([first, second]);

    destroy();
  });

  it('a revoke() for the pair already in flight does not send it again', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens);
    s.api.on('POST', '/auth/revoke', () => ({ body: { ok: true }, delay: 1000 }));

    const { auth, destroy } = createTab(s);

    auth.queries.login.execute({ body: {} });
    s.tick();

    const first = auth.features.tokenRevocation.revoke();
    const second = auth.features.tokenRevocation.revoke();
    await s.settle(1000);
    await s.settle();

    expect(second).toBe(first);
    expect(s.api.requestCount('POST', '/auth/revoke')).toBe(1);

    auth.logout();
    await s.settle(1000);
    await s.settle();

    destroy();
  });

  describe('multi-tab', () => {
    let bus: FakeBroadcastChannelHandle;
    let locks: FakeWebLocksHandle;

    beforeEach(() => {
      bus = installFakeBroadcastChannel();
      locks = installFakeWebLocks();
    });

    afterEach(() => {
      bus.restore();
      locks.restore();
    });

    const openTabs = async (s: Scenario, name: string, revokeOn?: readonly BearerAuthSessionEndCause[]) => {
      const tabs = [0, 1, 2].map(() => createTab(s, { name, multiTab: true, revokeOn }));
      await sync(s);
      s.tick(251);
      await sync(s);

      tabs[0]!.auth.queries.login.execute({ body: {} });
      await sync(s);

      for (const tab of tabs) expect(tab.auth.sessionStatus()).toBe('authenticated');

      return tabs;
    };

    it('only the tab a logout started in revokes', async () => {
      const s = scenario();
      s.api.on('POST', '/auth/login', issueTokens);
      s.api.on('POST', '/auth/revoke', () => ({ body: { ok: true } }));

      const tabs = await openTabs(s, 'auth-scan-multi-tab-revoke');

      tabs[1]!.auth.logout();
      await sync(s);

      for (const tab of tabs) expect(tab.auth.sessionStatus()).toBe('anonymous');
      expect(s.api.requestCount('POST', '/auth/revoke')).toBe(1);

      tabs[0]!.auth.queries.login.execute({ body: {} });
      await sync(s);
      tabs[2]!.auth.logout('expired');
      await sync(s);

      expect(tabs[0]!.auth.sessionEndCause()).toBe('expired');
      expect(s.api.requestCount('POST', '/auth/revoke')).toBe(2);

      for (const tab of tabs) tab.destroy();
    });

    it('a revokeOn that names otherTab revokes in the tabs the logout reached as well', async () => {
      const s = scenario();
      s.api.on('POST', '/auth/login', issueTokens);
      s.api.on('POST', '/auth/revoke', () => ({ body: { ok: true } }));

      const tabs = await openTabs(s, 'auth-scan-multi-tab-revoke-other', ['user', 'otherTab']);

      tabs[0]!.auth.logout();
      await sync(s);

      expect(s.api.requestCount('POST', '/auth/revoke')).toBe(3);

      for (const tab of tabs) tab.destroy();
    });

    it('is inert in a server render: no messages, no locks, no timers, and anonymous at once', async () => {
      const s = scenario();

      const tab = createTab(s, {
        name: 'auth-scan-ssr',
        multiTab: true,
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      });

      expect(tab.auth.sessionStatus()).toBe('anonymous');
      expect(tab.auth.features.multiTabSync.isLeader()).toBe(true);
      expect(tab.auth.features.multiTabSync.leadership).toBe('off');

      await sync(s);

      expect(bus.posted).toEqual([]);
      expect(locks.heldNames()).toEqual([]);
      expect(locks.pendingNames()).toEqual([]);

      tab.destroy();
    });
  });
});
