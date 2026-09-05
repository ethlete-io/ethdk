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
  BearerAuthMultiTabSyncConfig,
  createBearerAuthProvider,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  withAuthenticationQuery,
  withBearerAuthMultiTabSync,
  withInactivityLogout,
  withRefreshQuery,
} from '../index';
import { mintToken, Scenario, ScenarioAuthBuilders, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const PROVIDER_NAME = 'auth-multi-tab-leadership-scenario';
const INACTIVITY_TIMEOUT = 100_000;

type TokenArgs = { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } };
type Profile = { response: { id: string } };

let tabCounter = 0;

const is401 = (entry: { error: unknown }) => entry.error instanceof HttpErrorResponse && entry.error.status === 401;

type TabOptions = { syncConfig?: BearerAuthMultiTabSyncConfig };

/** One browser tab: its own query client and auth provider, sharing the fake API and the sync channel. */
const createAuthTab = (s: Scenario, options: TabOptions = {}) => {
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
    features: [withBearerAuthMultiTabSync(options.syncConfig)],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth multi-tab leadership scenario: failed to create the tab auth provider');

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

/** Same as {@link createAuthTab}, with `withInactivityLogout` added so idleness can be measured. */
const createInactivityTab = (s: Scenario, activityEvents: string[], options: TabOptions = {}) => {
  const clientRef = createQueryClient({ name: `auth-tab-client-${++tabCounter}`, baseUrl: BASE_URL, keepUnusedFor: 0 });
  const authRef = createBearerAuthProvider({
    name: PROVIDER_NAME,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: createPostQuery(clientRef)<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', {
        queryCreator: createPostQuery(clientRef)<TokenArgs>('/auth/refresh'),
        refreshStrategy: 0.5,
      }),
    ],
    features: [
      withBearerAuthMultiTabSync(options.syncConfig),
      withInactivityLogout({ inactivityTimeout: INACTIVITY_TIMEOUT, activityEvents }),
    ],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth multi-tab leadership scenario: failed to create the tab auth provider');

  return { auth, destroy: () => injector.destroy() };
};

/**
 * Holds the leader lock and answers (or ignores) `claim` messages over the fake primitives without running
 * library code. One shared clock and microtask queue cannot freeze one real tab while another ticks.
 */
const createFrozenLeaderTab = (
  name: string,
  options: { isVisible?: boolean; answersClaims?: boolean; answersRefreshRequests?: boolean } = {},
) => {
  const isVisible = options.isVisible ?? false;
  const answersClaims = options.answersClaims ?? false;
  const answersRefreshRequests = options.answersRefreshRequests ?? false;

  let isLeader = false;
  let release = () => {
    /* not granted yet */
  };

  const hold = () => {
    navigator.locks
      .request(`ethlete-auth:leader:${name}`, () => {
        isLeader = true;

        return new Promise<void>((resolve) => {
          release = () => {
            isLeader = false;
            resolve();
          };
        });
      })
      .catch(() => {
        isLeader = false;
      });
  };

  hold();

  const channel = new BroadcastChannel(`ethlete-auth-leader:${name}`);

  channel.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data as { type?: string } | null;

    if (data?.type === 'refresh-requested') {
      if (answersRefreshRequests && isLeader) channel.postMessage({ type: 'refresh-started' });

      return;
    }

    if (data?.type !== 'claim' || !answersClaims || !isLeader) return;

    channel.postMessage({ type: 'leader-alive', isVisible });

    if (!isVisible) {
      release();
      hold();
    }
  };

  return {
    isLeader: () => isLeader,
    close: () => {
      channel.close();
      release();
    },
  };
};

/** Holds the takeover's refresh lock, so a follower that runs out of patience stands down instead. */
const holdRefreshLock = (name: string) => {
  let release = () => {
    /* not granted yet */
  };

  void navigator.locks.request(
    `ethlete-auth:refresh:${name}`,
    () => new Promise<void>((resolve) => (release = resolve)),
  );

  return { release: () => release() };
};

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
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

describe('auth multi-tab leadership scenario', () => {
  let bus: FakeBroadcastChannelHandle;
  let locks: FakeWebLocksHandle;

  beforeEach(() => {
    bus = installFakeBroadcastChannel();
    locks = installFakeWebLocks();
  });

  afterEach(() => {
    setVisibility('visible');
    bus.restore();
    locks.restore();
  });

  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  const activityMessages = () =>
    bus.posted.filter(
      (m) => m.channel === `ethlete-auth-sync:${PROVIDER_NAME}` && (m.data as { type?: string })?.type === 'activity',
    );

  const refreshRequestedMessages = () =>
    bus.posted.filter(
      (m) =>
        m.channel === `ethlete-auth-leader:${PROVIDER_NAME}` &&
        (m.data as { type?: string })?.type === 'refresh-requested',
    );

  it('a follower re-asks the leader for a delegated refresh every 3 seconds, up to three times, and adopts the pair once the leader answers', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', () => ({ ...issueTokens(15 * 60 * 1000)(), delay: 7000 }));
    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    const tokenAtLogin = b.auth.accessToken();
    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    s.tick();
    await sync(s);

    s.tick(3000);
    await sync(s);
    s.tick(3000);
    await sync(s);
    s.tick(1500);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(b.auth.accessToken()).not.toBe(tokenAtLogin);
    expect(queryB.response()).toEqual({ id: 'me' });
    expect(refreshRequestedMessages()).toHaveLength(3);

    s.expectError(is401);
    a.destroy();
    b.destroy();
  });

  it('a follower spends the refresh token itself once the leader never answers at all, and the new pair reaches every tab', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));
    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    // Both tabs must stay hidden: a visible tab claims the leadership itself before the takeover runs.
    setVisibility('hidden');
    const leader = createFrozenLeaderTab(PROVIDER_NAME);

    const b = createAuthTab(s);
    const c = createAuthTab(s);
    await sync(s);

    b.auth.queries.login.execute({ body: {} });
    await sync(s);
    expect(c.auth.accessToken()).toBe(b.auth.accessToken());
    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    const tokenAtLogin = b.auth.accessToken();
    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    s.tick();
    await sync(s);

    s.tick(3000);
    await sync(s);
    s.tick(3000);
    await sync(s);
    s.tick(3000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(b.auth.accessToken()).not.toBe(tokenAtLogin);
    expect(c.auth.accessToken()).toBe(b.auth.accessToken());
    expect(c.auth.refreshToken()).toBe(b.auth.refreshToken());
    expect(queryB.response()).toEqual({ id: 'me' });

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    s.expectError(is401);
    leader.close();
    b.destroy();
    c.destroy();
  });

  it('gives a leader that answers with a refresh-started six windows before the follower takes over', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));
    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    setVisibility('hidden');
    const leader = createFrozenLeaderTab(PROVIDER_NAME, { answersRefreshRequests: true });

    const b = createAuthTab(s);
    await sync(s);

    b.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    const tokenAtLogin = b.auth.accessToken();
    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    s.tick();
    await sync(s);

    // The three windows a silent leader gets. This one answered, so nothing is taken off it yet.
    for (let window = 0; window < 3; window++) {
      s.tick(3000);
      await sync(s);
    }

    expect(refreshRequestedMessages()).toHaveLength(4);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);
    expect(b.auth.accessToken()).toBe(tokenAtLogin);

    // Windows four to six, and then the takeover: answering says a refresh started, not that it lands.
    for (let window = 0; window < 3; window++) {
      s.tick(3000);
      await sync(s);
    }

    expect(refreshRequestedMessages()).toHaveLength(6);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(b.auth.accessToken()).not.toBe(tokenAtLogin);
    expect(queryB.response()).toEqual({ id: 'me' });

    s.expectError(is401);
    leader.close();
    b.destroy();
  });

  it('starts the ladder over when the takeover itself could not run yet', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(60000));
    s.api.on('POST', '/auth/refresh', issueTokens(60000));

    setVisibility('hidden');
    const leader = createFrozenLeaderTab(PROVIDER_NAME);

    const b = createAuthTab(s);
    await sync(s);

    b.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    // A login of this tab's own, in flight until t=51s and rejected there. The ladder the tab's own
    // proactive tick starts reaches its takeover while it runs, so that takeover spends nothing.
    s.api.once('POST', '/auth/login', () => ({ status: 401, body: { message: 'rejected' }, delay: 50_000 }));
    b.auth.queries.login.execute({ body: { attempt: 2 } });
    s.tick(1000);
    await sync(s);

    const advanceTo = async (ms: number) => {
      for (let elapsed = 0; elapsed < ms; elapsed += 1000) {
        s.tick(1000);
        await sync(s);
      }
    };

    // Through the tick due at half the 60 second lifetime, its ladder, and the takeover at its end.
    await advanceTo(54_000);

    expect(refreshRequestedMessages().length).toBeGreaterThan(0);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);
    expect(b.auth.isAuthenticated()).toBe(true);

    // The next delegated tick, 30 seconds on, runs a full ladder again rather than finding the budget
    // spent - and this time nothing stops the takeover at its end.
    await advanceTo(30_000);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(b.auth.isAuthenticated()).toBe(true);

    s.expectError(is401);
    leader.close();
    b.destroy();
  });

  it('two tabs that go stale at the same instant refresh the token exactly once', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));
    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    setVisibility('hidden');
    const leader = createFrozenLeaderTab(PROVIDER_NAME);

    const b = createAuthTab(s);
    const c = createAuthTab(s);
    await sync(s);

    b.auth.queries.login.execute({ body: {} });
    await sync(s);
    const tokenAtLogin = b.auth.accessToken();
    expect(c.auth.accessToken()).toBe(tokenAtLogin);

    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    const queryC = c.consumer().run(() => c.getSecure<Profile>('/secure/profile')());
    s.tick();
    await sync(s);

    s.tick(3000);
    await sync(s);
    s.tick(3000);
    await sync(s);
    s.tick(3000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(b.auth.accessToken()).not.toBe(tokenAtLogin);
    expect(c.auth.accessToken()).toBe(b.auth.accessToken());
    expect(c.auth.refreshToken()).toBe(b.auth.refreshToken());
    expect(queryB.response()).toEqual({ id: 'me' });
    expect(queryC.response()).toEqual({ id: 'me' });

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);
    expect(c.auth.features.multiTabSync.isLeader()).toBe(false);

    s.expectError(is401);
    s.expectError(is401);
    leader.close();
    b.destroy();
    c.destroy();
  });

  it('a delegated refresh-requested that reaches the leader only after it already rotated the pair is answered with the pair it holds', async () => {
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

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    const tokenAtLogin = b.auth.accessToken();

    const queryA = a.consumer().run(() => a.getSecure<Profile>('/secure/profile')());
    s.tick();
    s.tick(1);
    s.tick(1);

    expect(a.auth.accessToken()).not.toBe(tokenAtLogin);
    expect(b.auth.accessToken()).toBe(tokenAtLogin);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    s.tick();
    s.tick(1);

    expect(b.auth.accessToken()).toBe(tokenAtLogin);
    expect(refreshRequestedMessages()).toHaveLength(1);

    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(queryA.response()).toEqual({ id: 'me' });
    expect(queryB.response()).toEqual({ id: 'me' });

    s.expectError(is401);
    s.expectError(is401);
    a.destroy();
    b.destroy();
  });

  it("a follower's delegated refresh-requested arriving while the leader's own refresh is still in flight does not spend a second refresh token", async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', () => ({ ...issueTokens(15 * 60 * 1000)(), delay: 5000 }));
    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    const tokenAtLogin = b.auth.accessToken();

    const queryA = a.consumer().run(() => a.getSecure<Profile>('/secure/profile')());
    s.tick();
    s.tick(1);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(a.auth.accessToken()).toBe(tokenAtLogin);

    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    s.tick();

    expect(refreshRequestedMessages()).toHaveLength(1);

    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(a.auth.accessToken()).toBe(tokenAtLogin);

    s.tick(5000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(a.auth.accessToken()).not.toBe(tokenAtLogin);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(queryA.response()).toEqual({ id: 'me' });
    expect(queryB.response()).toEqual({ id: 'me' });

    s.expectError(is401);
    s.expectError(is401);
    a.destroy();
    b.destroy();
  });

  it("a follower's delegated refresh waits out the leader's in-flight login instead of taking it over", async () => {
    const s = scenario();
    s.api.once('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/login', () => ({ ...issueTokens(15 * 60 * 1000)(), delay: 12_000 }));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));
    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    const tokenAtLogin = b.auth.accessToken();

    a.auth.queries.login.execute({ body: {} });
    s.tick();
    await sync(s);

    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    s.tick();
    await sync(s);

    expect(refreshRequestedMessages()).toHaveLength(1);

    s.tick(3000);
    await sync(s);
    s.tick(3000);
    await sync(s);
    s.tick(3000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);
    expect(b.auth.accessToken()).toBe(tokenAtLogin);

    s.tick(3000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);
    expect(s.api.requestCount('POST', '/auth/login')).toBe(2);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(b.auth.accessToken()).not.toBe(tokenAtLogin);
    expect(queryB.response()).toEqual({ id: 'me' });

    s.expectError(is401);
    a.destroy();
    b.destroy();
  });

  it('a leader that runs no secure queries keeps answering delegated refreshes', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));
    s.api.protect('/secure/**');

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    const rotations: (string | null)[] = [];

    for (let round = 1; round <= 4; round++) {
      const route: `/${string}` = `/secure/round-${round}`;
      s.api.once('GET', route, () => ({ status: 401, body: { message: 'revoked' } }));
      s.api.on('GET', route, () => ({ body: { id: 'me' } }));

      const queryB = b.consumer().run(() => b.getSecure<Profile>(route)());
      s.tick();
      await sync(s);
      s.flush();
      await sync(s);

      expect([round, queryB.response()]).toEqual([round, { id: 'me' }]);
      rotations.push(a.auth.accessToken());
    }

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(4);
    expect(new Set(rotations).size).toBe(4);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(a.auth.isAuthenticated()).toBe(true);

    for (let i = 0; i < 4; i++) s.expectError(is401);

    a.destroy();
    b.destroy();
  });

  it('a tab that becomes visible claims the leadership, and the hidden leader gives way', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    setVisibility('hidden');
    const leader = createFrozenLeaderTab(PROVIDER_NAME, { isVisible: false, answersClaims: true });
    await flushMultiTabSync();

    const b = createAuthTab(s);
    const c = createAuthTab(s);
    await sync(s);

    expect(leader.isLeader()).toBe(true);
    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);
    expect(c.auth.features.multiTabSync.isLeader()).toBe(false);

    setVisibility('visible');
    await sync(s);

    expect(leader.isLeader()).toBe(false);
    expect(b.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(c.auth.features.multiTabSync.isLeader()).toBe(false);

    leader.close();
    b.destroy();
    c.destroy();
  });

  it('activity in one tab resets the inactivity timer in another tab over the sync channel', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createInactivityTab(s, ['keydown']);
    const b = createInactivityTab(s, ['mousedown']);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);
    expect(b.auth.isAuthenticated()).toBe(true);

    s.tick(90_000);
    await sync(s);

    // `b` listens for `mousedown` only, so a `keydown` can reach its timer through the broadcast alone.
    document.dispatchEvent(new KeyboardEvent('keydown'));
    await sync(s);

    expect(a.auth.features.inactivityLogout.calculateTimeUntilLogout()).toBeGreaterThan(90_000);
    expect(b.auth.features.inactivityLogout.calculateTimeUntilLogout()).toBeGreaterThan(90_000);

    s.tick(90_000);
    await sync(s);

    expect(a.auth.isAuthenticated()).toBe(true);
    expect(b.auth.isAuthenticated()).toBe(true);

    s.tick(100_001);
    await sync(s);

    expect(a.auth.sessionEndCause()).toBe('inactivity');
    expect(b.auth.sessionStatus()).toBe('anonymous');
    expect(b.auth.sessionEndCause()).toBe('inactivity');

    a.destroy();
    b.destroy();
  });

  it('a proactive token refresh right before the idle window ends is not counted as activity', () => {
    const s = scenario();
    const auth = s.auth({
      accessTokenExpiresInMs: 20_000,
      refreshStrategy: 1000,
      features: [withInactivityLogout<ScenarioAuthBuilders>({ inactivityTimeout: 20_000 })],
    });

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    expect(auth.isAuthenticated()).toBe(true);

    s.tick(19_000);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.sessionStatus()).toBe('authenticated');

    s.tick(1001);

    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('inactivity');

    c.destroy();
  });

  it('reports isLeader false until the next microtask after the lock is granted', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(false);

    await flushMultiTabSync();

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(a.auth.features.multiTabSync.leadership).toBe('election');

    a.destroy();
  });

  it('hands the leadership to the longest-waiting tab when the leader closes', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    const c = createAuthTab(s);
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);
    expect(c.auth.features.multiTabSync.isLeader()).toBe(false);

    a.destroy();
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(c.auth.features.multiTabSync.isLeader()).toBe(false);

    b.destroy();
    await sync(s);

    expect(c.auth.features.multiTabSync.isLeader()).toBe(true);

    c.destroy();
  });

  it('elects itself with leadership unsupported when the browser has no Web Locks', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    locks.restore();

    const a = createAuthTab(s);
    const b = createAuthTab(s);
    await sync(s);

    expect(a.auth.features.multiTabSync.leadership).toBe('unsupported');
    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(a.auth.features.multiTabSync.instanceCount()).toBe(1);
    expect(b.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(b.auth.features.multiTabSync.instanceCount()).toBe(1);

    a.destroy();
    b.destroy();
  });

  it('lets every tab refresh its own tokens with leadership off when leaderElection is false', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s, { syncConfig: { leaderElection: false } });
    const b = createAuthTab(s, { syncConfig: { leaderElection: false } });
    await sync(s);

    expect(a.auth.features.multiTabSync.leadership).toBe('off');
    expect(b.auth.features.multiTabSync.leadership).toBe('off');
    expect(locks.heldNames()).toEqual([]);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.accessToken()).toBe(a.auth.accessToken());

    s.tick(7.5 * 60 * 1000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(2);

    a.destroy();
    b.destroy();
  });

  it('a lone hidden leader gives the lock up and takes it straight back', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);

    setVisibility('hidden');
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(locks.heldNames()).toEqual([`ethlete-auth:leader:${PROVIDER_NAME}`]);

    a.destroy();
  });

  it('gives the leadership up on freeze and claims it back on resume', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createAuthTab(s);
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);

    document.dispatchEvent(new Event('freeze'));
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(false);
    expect(locks.heldNames()).toEqual([]);

    document.dispatchEvent(new Event('resume'));
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);

    a.destroy();
  });

  it('steals the leadership from a frozen leader once a claim goes unanswered for 1.5 seconds', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const leader = createFrozenLeaderTab(PROVIDER_NAME);
    await flushMultiTabSync();

    expect(leader.isLeader()).toBe(true);

    const b = createAuthTab(s);
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    s.tick(1500);
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(leader.isLeader()).toBe(false);

    leader.close();
    b.destroy();
  });

  it('a follower that has become the leader refreshes itself instead of re-asking', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));
    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    setVisibility('hidden');
    const leader = createFrozenLeaderTab(PROVIDER_NAME);

    const b = createAuthTab(s);
    await sync(s);

    b.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    const queryB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    s.tick();
    await sync(s);

    expect(refreshRequestedMessages()).toHaveLength(1);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    leader.close();
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(true);

    s.tick(3000);
    await sync(s);
    s.flush();
    await sync(s);

    expect(refreshRequestedMessages()).toHaveLength(1);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(queryB.response()).toEqual({ id: 'me' });

    s.expectError(is401);
    b.destroy();
  });

  it('does not escalate a delegated refresh while the token still has more than 30 seconds left', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));

    setVisibility('hidden');
    const leader = createFrozenLeaderTab(PROVIDER_NAME);

    const b = createAuthTab(s);
    await sync(s);

    b.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    // The follower's own proactive tick is due at half the 15 minute lifetime, with 7.5 minutes of
    // token left - far outside the 30 second window that lets it act.
    s.tick(7.5 * 60 * 1000 + 1000);
    await sync(s);

    expect(refreshRequestedMessages()).toHaveLength(0);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    // Past the point where the token goes stale, the tab asks and then takes the refresh over.
    s.tick(7 * 60 * 1000);
    await sync(s);

    expect(refreshRequestedMessages().length).toBeGreaterThan(0);

    s.tick(3000);
    await sync(s);
    s.tick(3000);
    await sync(s);
    s.tick(3000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(b.auth.isAuthenticated()).toBe(true);

    leader.close();
    b.destroy();
  });

  it('keeps a delegated proactive tick coming back long past the five re-arms a declined one spends', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(60000));
    s.api.on('POST', '/auth/refresh', issueTokens(60000));

    setVisibility('hidden');
    const leader = createFrozenLeaderTab(PROVIDER_NAME);
    // Every takeover the ladder reaches finds the lock taken and stands down, so the tick keeps
    // being one that waits on another tab for as long as the test runs.
    const refreshLock = holdRefreshLock(PROVIDER_NAME);

    const b = createAuthTab(s);
    await sync(s);

    b.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    const advanceRounds = async (rounds: number) => {
      for (let round = 0; round < rounds; round++) {
        s.tick(30000);
        await sync(s);
      }
    };

    // The tick due at half the 60 second lifetime, plus the five re-arms a budgeted attempt spends.
    await advanceRounds(7);
    const asksWithinTheBudget = refreshRequestedMessages().length;

    expect(asksWithinTheBudget).toBeGreaterThan(0);

    await advanceRounds(7);

    expect(refreshRequestedMessages().length).toBeGreaterThan(asksWithinTheBudget);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);
    expect(b.auth.isAuthenticated()).toBe(true);

    refreshLock.release();
    leader.close();
    b.destroy();
  });

  it('announces activity at most once per quarter of the inactivity timeout, and re-broadcasts nothing it hears', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createInactivityTab(s, ['keydown']);
    const b = createInactivityTab(s, ['mousedown']);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    const before = activityMessages().length;

    for (let i = 0; i < 10; i++) {
      s.tick(3000);
      document.dispatchEvent(new KeyboardEvent('keydown'));
      await sync(s);
    }

    // Ten keystrokes over 30s, with a quarter of the 100s timeout between announcements.
    expect(activityMessages().length - before).toBe(2);
    expect(b.auth.isAuthenticated()).toBe(true);

    a.destroy();
    b.destroy();
  });

  it('resetTimer() in one tab postpones the countdown in every other tab', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createInactivityTab(s, ['keydown']);
    const b = createInactivityTab(s, ['mousedown']);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    s.tick(50000);
    await sync(s);

    expect(b.auth.features.inactivityLogout.calculateTimeUntilLogout()).toBeLessThan(51_000);

    const before = activityMessages().length;

    a.auth.features.inactivityLogout.resetTimer();
    await sync(s);

    expect(activityMessages().length).toBe(before + 1);
    expect(b.auth.features.inactivityLogout.calculateTimeUntilLogout()).toBeGreaterThan(99_000);

    a.destroy();
    b.destroy();
  });

  it('does not treat a tab joining a live session as user activity', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));

    const a = createInactivityTab(s, ['keydown']);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    s.tick(50000);
    await sync(s);

    const before = a.auth.features.inactivityLogout.calculateTimeUntilLogout();

    const b = createInactivityTab(s, ['mousedown']);
    await sync(s);

    expect(b.auth.isAuthenticated()).toBe(true);
    expect(a.auth.features.inactivityLogout.calculateTimeUntilLogout()).toBeLessThanOrEqual(before ?? 0);
    expect(a.auth.features.inactivityLogout.calculateTimeUntilLogout()).toBeLessThan(51_000);

    a.destroy();
    b.destroy();
  });

  it('times an inactive tab out on its own with syncLogout: false, leaving the active tab signed in', async () => {
    const s = scenario();
    s.api.on('POST', '/auth/login', issueTokens(15 * 60 * 1000));
    s.api.on('POST', '/auth/refresh', issueTokens(15 * 60 * 1000));

    const a = createInactivityTab(s, ['keydown'], { syncConfig: { syncLogout: false } });
    const b = createInactivityTab(s, ['mousedown'], { syncConfig: { syncLogout: false } });
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.isAuthenticated()).toBe(true);

    for (let i = 0; i < 13; i++) {
      s.tick(9000);
      document.dispatchEvent(new KeyboardEvent('keydown'));
      await sync(s);
    }

    expect(a.auth.isAuthenticated()).toBe(true);
    expect(b.auth.sessionStatus()).toBe('anonymous');
    expect(b.auth.sessionEndCause()).toBe('inactivity');

    a.destroy();
    b.destroy();
  });
});
