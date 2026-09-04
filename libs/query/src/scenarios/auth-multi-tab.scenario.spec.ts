import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, inject } from '@angular/core';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createBearerAuthProvider,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  withAuthenticationQuery,
  withBearerAuthMultiTabSync,
  withRefreshQuery,
} from '../index';
import { mintToken, Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const PROVIDER_NAME = 'auth-multi-tab-scenario';

type TokenArgs = { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } };
type Profile = { response: { id: string } };

let tabCounter = 0;

const is401 = (entry: { error: unknown }) => entry.error instanceof HttpErrorResponse && entry.error.status === 401;

/** One browser tab: its own query client and auth provider, sharing the fake API and the sync channel. */
const createAuthTab = (s: Scenario) => {
  const clientRef = createQueryClient({ name: `auth-tab-client-${++tabCounter}`, baseUrl: BASE_URL, keepUnusedFor: 0 });
  const authRef = createBearerAuthProvider({
    name: PROVIDER_NAME,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: createPostQuery(clientRef)<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', {
        queryCreator: createPostQuery(clientRef)<TokenArgs>('/auth/refresh'),
        refreshStrategy: 0.5,
        autoRetryOn401: true,
      }),
    ],
    features: [withBearerAuthMultiTabSync()],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth multi-tab scenario: failed to create the tab auth provider');

  const consumers: EnvironmentInjector[] = [];

  return {
    auth,
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
});
