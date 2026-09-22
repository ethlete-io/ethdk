import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, inject, signal } from '@angular/core';
import {
  createUnsavedChangesTracker,
  injectUnsavedChangesCoordinator,
  provideUnsavedChangesCoordinator,
} from '@ethlete/core';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BearerAuthMultiTabSyncConfig,
  createBearerAuthProvider,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  withAuthenticationQuery,
  withBearerAuthMultiTabSync,
  withPersistentAuth,
  withRefreshQuery,
  withTracking,
} from '../index';
import { inProductionMode, mintToken, Scenario, ScenarioAuthBuilders, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const PROVIDER_NAME = 'auth-multi-tab-scenario';

type TokenArgs = { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } };
type Profile = { response: { id: string } };

let tabCounter = 0;

const is401 = (entry: { error: unknown }) => entry.error instanceof HttpErrorResponse && entry.error.status === 401;

type TabOptions = { name?: string; syncConfig?: BearerAuthMultiTabSyncConfig; trackInto?: string[] };

const trackingInto = (events: string[]) =>
  withTracking<ScenarioAuthBuilders>({
    on: {
      loginExecute: () => events.push('loginExecute'),
      loginSuccess: () => events.push('loginSuccess'),
      loginFailure: () => events.push('loginFailure'),
      tokenRefreshSuccess: ({ automatic }) => events.push(`tokenRefreshSuccess:${automatic}`),
      logout: ({ cause }) => events.push(`logout:${cause}`),
    },
  });

/** One browser tab: its own query client and auth provider, sharing the fake API and the sync channel. */
const createAuthTab = (s: Scenario, options: TabOptions = {}) => {
  const clientRef = createQueryClient({ name: `auth-tab-client-${++tabCounter}`, baseUrl: BASE_URL, keepUnusedFor: 0 });
  const authRef = createBearerAuthProvider({
    name: options.name ?? PROVIDER_NAME,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: createPostQuery(clientRef)<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', {
        queryCreator: createPostQuery(clientRef)<TokenArgs>('/auth/refresh'),
        refreshStrategy: 0.5,
        autoRetryOn401: true,
      }),
    ],
    features: [
      withBearerAuthMultiTabSync(options.syncConfig),
      ...(options.trackInto ? [trackingInto(options.trackInto)] : []),
    ] as unknown as readonly [ReturnType<typeof withBearerAuthMultiTabSync>],
  });

  // Its own coordinator rather than the shared root one, or a guard in one tab is the same object as
  // a guard in another and a cross-tab abandon proves nothing.
  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide(), ...provideUnsavedChangesCoordinator()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth multi-tab scenario: failed to create the tab auth provider');

  const consumers: EnvironmentInjector[] = [];

  return {
    auth,
    unsavedChanges: injector.runInContext(() => injectUnsavedChangesCoordinator()),
    getSecure: createSecureGetQuery(clientRef, authRef),
    consumer: () => {
      const child = createEnvironmentInjector([], injector);
      consumers.push(child);
      return { run: <T>(fn: () => T) => child.runInContext(fn) };
    },
    destroy: () => {
      for (const child of consumers) child.destroy();
      injector.destroy();
    },
  };
};

/** A tab that ships no multi-tab sync at all - the single-tab, kiosk or webview setup. */
const createLoneTab = (s: Scenario) => {
  const clientRef = createQueryClient({ name: `auth-tab-client-${++tabCounter}`, baseUrl: BASE_URL, keepUnusedFor: 0 });
  const authRef = createBearerAuthProvider({
    name: PROVIDER_NAME,
    queries: [
      withAuthenticationQuery('login', { queryCreator: createPostQuery(clientRef)<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', { queryCreator: createPostQuery(clientRef)<TokenArgs>('/auth/refresh') }),
    ],
    queryClientRef: clientRef,
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth multi-tab scenario: failed to create the lone tab auth provider');

  return { auth, destroy: () => injector.destroy() };
};

/** A tab that syncs and also restores its session from the remember-me cookie. */
const createPersistentTab = (s: Scenario) => {
  const clientRef = createQueryClient({ name: `auth-tab-client-${++tabCounter}`, baseUrl: BASE_URL, keepUnusedFor: 0 });
  const authRef = createBearerAuthProvider({
    name: PROVIDER_NAME,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: createPostQuery(clientRef)<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', { queryCreator: createPostQuery(clientRef)<TokenArgs>('/auth/refresh') }),
    ],
    features: [
      withBearerAuthMultiTabSync(),
      withPersistentAuth<ScenarioAuthBuilders>({
        autoLogin: { queryKey: 'refresh', buildArgs: (token: string) => ({ body: { token } }) },
      }),
    ] as unknown as readonly [],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth multi-tab scenario: failed to create the persistent tab auth provider');

  return { auth, destroy: () => injector.destroy() };
};

const issueTokens = (accessTokenExpiresInMs: number) => () => ({
  body: {
    accessToken: mintToken({ expiresInMs: accessTokenExpiresInMs }),
    refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
  },
});

const sync = async (s: Scenario) => {
  await s.settle();
  await flushMultiTabSync();
  await s.settle();
  await flushMultiTabSync();
  await s.settle();
};

describe('auth multi-tab scenario', () => {
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

  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  it('a login in one tab is adopted by the other as a token seed, and its logout ends the other session as otherTab', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);
    expect(b.auth.sessionStatus()).toBe('unknown');

    s.tick(251); // the bounded wait for another tab's session
    await sync(s);
    expect(b.auth.sessionStatus()).toBe('anonymous');

    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    s.tick();
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(0);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);
    s.flush();
    await s.settle();

    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(b.auth.executionState()).toEqual({ type: 'tokenSeed', state: 'success' });
    expect(b.auth.sessionStatus()).toBe('authenticated');
    expect(queryB.response()).toEqual({ id: 'me' });
    expect(s.api.requestCount('POST', '/auth/login')).toBe(1);

    a.auth.logout();
    await sync(s);

    expect(a.auth.sessionEndCause()).toBe('user');
    expect(b.auth.sessionStatus()).toBe('anonymous');
    expect(b.auth.sessionEndCause()).toBe('otherTab');
    expect(b.auth.accessToken()).toBeNull();
    expect(queryB.response()).toBeNull();

    a.destroy();
    b.destroy();
  });

  it('a tab that opens next to a live session adopts it without ever reading anonymous', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    await sync(s);
    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    const statuses: string[] = [];
    const b = createAuthTab(s);
    statuses.push(b.auth.sessionStatus());
    await sync(s);
    statuses.push(b.auth.sessionStatus());

    expect(statuses).toEqual(['unknown', 'authenticated']);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(b.auth.executionState()).toEqual({ type: 'tokenSeed', state: 'success' });

    a.destroy();
    b.destroy();
  });

  it('a session that expires in the leader ends in the follower as expired, not otherTab', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', () => ({ status: 401, body: { message: 'refresh token revoked' } }));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);
    expect(b.auth.isAuthenticated()).toBe(true);

    s.tick(7.5 * 60 * 1000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(a.auth.sessionEndCause()).toBe('expired');
    expect(b.auth.sessionStatus()).toBe('anonymous');
    expect(b.auth.sessionEndCause()).toBe('expired');

    s.expectError(is401);
    a.destroy();
    b.destroy();
  });

  it('two tabs holding the same token refresh it once, in the leader, and the follower adopts the pair', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);
    const tokenAtLogin = a.auth.accessToken();
    expect(b.auth.accessToken()).toBe(tokenAtLogin);

    s.tick(7.5 * 60 * 1000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(a.auth.accessToken()).not.toBe(tokenAtLogin);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(b.auth.refreshToken()).toBe(a.auth.refreshToken());

    a.destroy();
    b.destroy();
  });

  it('a 401 in the follower asks the leader to refresh, and the follower retries with the pair the leader broadcast', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));
    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);
    const tokenAtLogin = b.auth.accessToken();

    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    s.flush();
    await sync(s);
    s.flush();
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(a.auth.accessToken()).not.toBe(tokenAtLogin);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(2);
    expect(queryB.response()).toEqual({ id: 'me' });

    s.expectError(is401);
    a.destroy();
    b.destroy();
  });

  it('leaves no lock and no channel behind once both tabs are destroyed', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);
    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    a.destroy();
    b.destroy();
    await flushMultiTabSync();

    expect(locks.heldNames()).toEqual([]);
    expect(locks.pendingNames()).toEqual([]);
  });

  it('keeps two providers with different names on separate channels and separate sessions', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s, { name: `${PROVIDER_NAME}-a` });
    const b = createAuthTab(s, { name: `${PROVIDER_NAME}-b` });
    await sync(s);
    s.tick(251);
    await sync(s);

    expect(locks.heldNames().sort()).toEqual([
      `ethlete-auth:leader:${PROVIDER_NAME}-a`,
      `ethlete-auth:leader:${PROVIDER_NAME}-b`,
    ]);
    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(b.auth.features.multiTabSync.isLeader()).toBe(true);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(a.auth.isAuthenticated()).toBe(true);
    expect(b.auth.isAuthenticated()).toBe(false);
    expect(b.auth.sessionStatus()).toBe('anonymous');

    a.destroy();
    b.destroy();
  });

  it('syncs tokens but not logout with syncLogout: false', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s, { syncConfig: { syncLogout: false } });
    const b = createAuthTab(s, { syncConfig: { syncLogout: false } });
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.accessToken()).toBe(a.auth.accessToken());

    a.auth.logout();
    await sync(s);

    expect(a.auth.sessionStatus()).toBe('anonymous');
    expect(b.auth.sessionStatus()).toBe('authenticated');
    expect(b.auth.sessionEndCause()).toBeNull();

    a.destroy();
    b.destroy();
  });

  it('recounts instanceCount when a tab joins and when it says goodbye', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    await sync(s);

    expect(a.auth.features.multiTabSync.instanceCount()).toBe(1);

    const b = createAuthTab(s);
    await sync(s);

    expect(a.auth.features.multiTabSync.instanceCount()).toBe(2);
    expect(b.auth.features.multiTabSync.instanceCount()).toBe(2);

    b.destroy();
    await sync(s);

    expect(a.auth.features.multiTabSync.instanceCount()).toBe(1);

    a.destroy();
  });

  it('re-asks for the session on resume and on a pageshow out of the back/forward cache', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.isAuthenticated()).toBe(true);

    const stateRequests = () =>
      bus.posted.filter(
        (m) =>
          m.channel === `ethlete-auth-sync:${PROVIDER_NAME}` && (m.data as { type?: string })?.type === 'state-request',
      ).length;

    const before = stateRequests();

    document.dispatchEvent(new Event('resume'));
    await sync(s);

    expect(stateRequests()).toBe(before + 2);

    const restored = new Event('pageshow');
    Object.defineProperty(restored, 'persisted', { value: true });
    window.dispatchEvent(restored);
    await sync(s);

    expect(stateRequests()).toBe(before + 4);

    window.dispatchEvent(new Event('pageshow'));
    await sync(s);

    expect(stateRequests()).toBe(before + 4);

    a.destroy();
    b.destroy();
  });

  it('holds the cookie auto-login while the leader answers with the session it holds', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));

    const a = createPersistentTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(document.cookie).toContain('etAuth=');

    const requestsBeforeJoin = s.api.requests.length;
    const b = createPersistentTab(s);

    expect(b.auth.sessionStatus()).toBe('unknown');

    await sync(s);

    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(b.auth.sessionStatus()).toBe('authenticated');
    expect(s.api.requests.slice(requestsBeforeJoin)).toEqual([]);

    a.destroy();
    b.destroy();
    document.cookie = 'etAuth=; max-age=0; path=/';
  });

  it('settles a cross-tab login and logout in one round of broadcasts, with no echo', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    const c = createAuthTab(s);
    await sync(s);
    s.tick(251);
    await sync(s);

    const messagesOfType = (type: string) =>
      bus.posted.filter(
        (m) => m.channel === `ethlete-auth-sync:${PROVIDER_NAME}` && (m.data as { type?: string })?.type === type,
      ).length;

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(messagesOfType('tokens-updated')).toBe(1);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(c.auth.accessToken()).toBe(a.auth.accessToken());

    a.auth.logout();
    await sync(s);

    expect(messagesOfType('logout')).toBe(1);
    expect(b.auth.sessionStatus()).toBe('anonymous');
    expect(c.auth.sessionStatus()).toBe('anonymous');

    a.destroy();
    b.destroy();
    c.destroy();
  });

  it('opens no auth sync channel and requests no leader lock without withBearerAuthMultiTabSync', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const tab = createLoneTab(s);
    await sync(s);

    tab.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(tab.auth.isAuthenticated()).toBe(true);
    expect(locks.heldNames()).toEqual([]);
    expect(locks.pendingNames()).toEqual([]);
    expect(bus.posted).toEqual([]);

    tab.destroy();
  });

  it('writes the remember-me cookie for a pair adopted from another tab, and deletes it on a cross-tab logout', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    document.cookie = 'etAuth=; max-age=0; path=/';

    const a = createAuthTab(s);
    const b = createPersistentTab(s);
    await sync(s);
    s.tick(251);
    await sync(s);

    expect(document.cookie).not.toContain('etAuth=');

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(document.cookie).toContain('etAuth=');

    a.auth.logout();
    await sync(s);

    expect(b.auth.sessionEndCause()).toBe('otherTab');
    expect(document.cookie).not.toContain('etAuth=');

    a.destroy();
    b.destroy();
  });

  it('does not end a session adopted from another tab when the auto-login it raced comes back rejected', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));

    document.cookie = 'etAuth=; max-age=0; path=/';

    const seed = createPersistentTab(s);
    await sync(s);
    seed.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(document.cookie).toContain('etAuth=');

    seed.destroy();
    await sync(s);

    s.api.once('POST', '/auth/refresh', () => ({ status: 401, body: { message: 'expired' }, delay: 2000 }));

    const b = createPersistentTab(s);
    await sync(s);
    s.tick(251);
    await sync(s);

    expect(b.auth.sessionStatus()).toBe('restoring');

    const a = createAuthTab(s);
    await sync(s);
    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.accessToken()).toBe(a.auth.accessToken());

    s.tick(2000);
    await sync(s);

    expect(b.auth.sessionStatus()).toBe('authenticated');
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(b.auth.sessionEndCause()).toBeNull();

    s.expectError(is401);
    a.destroy();
    b.destroy();
    document.cookie = 'etAuth=; max-age=0; path=/';
  });

  it('broadcasts a seeded token pair to the other tabs', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);
    s.tick(251);
    await sync(s);

    const accessToken = mintToken({ expiresInMs: 15 * 60 * 1000 });
    const refreshToken = mintToken({ expiresInMs: 60 * 60 * 1000 });

    a.auth.setTokens(accessToken, refreshToken);
    await sync(s);

    expect(a.auth.executionState()).toEqual({ type: 'tokenSeed', state: 'success' });
    expect(b.auth.accessToken()).toBe(accessToken);
    expect(b.auth.refreshToken()).toBe(refreshToken);
    expect(b.auth.sessionStatus()).toBe('authenticated');

    a.destroy();
    b.destroy();
  });

  it("an incoming logout abandons the receiving tab's own unsaved-changes guards", async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);
    s.tick(251);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.accessToken()).toBe(a.auth.accessToken());

    const draft = signal('edited');
    b.consumer().run(() =>
      createUnsavedChangesTracker({ source: draft, defaultValue: '', confirm: () => true, tab: false }),
    );
    s.tick();

    expect(b.unsavedChanges.hasUnsavedChanges()).toBe(true);
    expect(a.unsavedChanges.hasUnsavedChanges()).toBe(false);

    a.auth.logout();
    await sync(s);

    expect(b.auth.executionState()).toEqual({ type: 'logout', state: 'success' });
    expect(b.auth.sessionEndCause()).toBe('otherTab');
    expect(b.unsavedChanges.hasUnsavedChanges()).toBe(false);

    a.destroy();
    b.destroy();
  });

  it('delivers tracking events raised before the leader lock is granted, once', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const events: string[] = [];
    const tab = createAuthTab(s, { trackInto: events });

    expect(tab.auth.features.multiTabSync.isLeader()).toBe(false);

    tab.auth.queries.login.execute({ body: {} });
    s.tick();

    expect(tab.auth.features.multiTabSync.isLeader()).toBe(false);
    expect(tab.auth.isAuthenticated()).toBe(true);

    await sync(s);
    await sync(s);

    expect(tab.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(events).toEqual(['loginExecute', 'loginSuccess']);

    tab.destroy();
  });

  it("fires each of a follower's tracking events once across the tabs, a snapshot-carrying one in the follower", async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const leaderEvents: string[] = [];
    const followerEvents: string[] = [];
    const a = createAuthTab(s, { trackInto: leaderEvents });
    const b = createAuthTab(s, { trackInto: followerEvents });
    await sync(s);
    s.tick(251);
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    b.auth.queries.login.execute({ body: {} });
    await sync(s);
    await sync(s);

    expect(leaderEvents).toEqual(['loginExecute']);
    expect(followerEvents).toEqual(['loginSuccess']);
    s.expectWarning(/Could not forward the "loginSuccess" tracking event/);

    b.auth.logout();
    await sync(s);

    expect(leaderEvents).toEqual(['loginExecute', 'logout:user', 'logout:otherTab']);
    expect(followerEvents).toEqual(['loginSuccess']);

    a.destroy();
    b.destroy();
  });

  it('keeps the tracking events of two providers on one origin apart', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const xLeader: string[] = [];
    const xFollower: string[] = [];
    const yLeader: string[] = [];
    const x1 = createAuthTab(s, { name: `${PROVIDER_NAME}-x`, trackInto: xLeader });
    const x2 = createAuthTab(s, { name: `${PROVIDER_NAME}-x`, trackInto: xFollower });
    const y = createAuthTab(s, { name: `${PROVIDER_NAME}-y`, trackInto: yLeader });
    await sync(s);
    s.tick(251);
    await sync(s);

    x2.auth.queries.login.execute({ body: {} });
    await sync(s);
    await sync(s);

    expect([...xLeader, ...xFollower]).toEqual(['loginExecute', 'loginSuccess']);
    expect(yLeader).toEqual([]);
    s.expectWarning(/Could not forward the "loginSuccess" tracking event/);

    y.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(yLeader).toEqual(['loginExecute', 'loginSuccess']);
    expect([...xLeader, ...xFollower]).toEqual(['loginExecute', 'loginSuccess']);

    x1.destroy();
    x2.destroy();
    y.destroy();
  });

  it('reports a proactive refresh as tokenRefreshSuccess { automatic: true } once across the tabs', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));

    const leaderEvents: string[] = [];
    const followerEvents: string[] = [];
    const a = createAuthTab(s, { trackInto: leaderEvents });
    const b = createAuthTab(s, { trackInto: followerEvents });
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    s.tick(7.5 * 60 * 1000 + 1000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect([...leaderEvents, ...followerEvents].filter((e) => e.startsWith('tokenRefresh'))).toEqual([
      'tokenRefreshSuccess:true',
    ]);

    a.destroy();
    b.destroy();
  });

  it("fires a follower's forwarded tracking event in the leader alone, never in the other followers", async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const leaderEvents: string[] = [];
    const followerEvents: string[] = [];
    const bystanderEvents: string[] = [];
    const a = createAuthTab(s, { trackInto: leaderEvents });
    const b = createAuthTab(s, { trackInto: followerEvents });
    const c = createAuthTab(s, { trackInto: bystanderEvents });
    await sync(s);
    s.tick(251);
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(a.auth.features.multiTabSync.instanceCount()).toBe(3);

    b.auth.queries.login.execute({ body: {} });
    await sync(s);
    await sync(s);

    expect(leaderEvents).toEqual(['loginExecute']);
    expect(followerEvents).toEqual(['loginSuccess']);
    expect(bystanderEvents).toEqual([]);
    expect(c.auth.isAuthenticated()).toBe(true);
    s.expectWarning(/Could not forward the "loginSuccess" tracking event/);

    a.destroy();
    b.destroy();
    c.destroy();
  });

  it('fires a tracking event that cannot be forwarded in the follower without a warning in production', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const leaderEvents: string[] = [];
    const followerEvents: string[] = [];
    const a = createAuthTab(s, { trackInto: leaderEvents });
    const b = createAuthTab(s, { trackInto: followerEvents });
    await sync(s);
    s.tick(251);
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    inProductionMode(() => {
      b.auth.queries.login.execute({ body: {} });
      s.tick();
      s.tick();
    });
    await sync(s);

    expect(followerEvents).toEqual(['loginSuccess']);
    expect(leaderEvents).toEqual(['loginExecute']);
    expect(s.warnings).toEqual([]);

    a.destroy();
    b.destroy();
  });

  it("caps a follower's run of fresh-token 401s at three delegated refreshes, like a lone tab's", async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));
    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());

    for (let i = 0; i < 20; i++) {
      s.tick(50);
      await sync(s);
    }

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(3);
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(4);
    expect(queryB.error()?.code).toBe(401);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(b.auth.isAuthenticated()).toBe(true);

    for (let i = 0; i < 4; i++) s.expectError(is401);
    a.destroy();
    b.destroy();
  });
});
