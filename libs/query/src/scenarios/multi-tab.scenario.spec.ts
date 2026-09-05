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
  createGetQuery,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  QueryClient,
  QueryClientRef,
  QueryMultiTabSyncConfig,
  QUERY_SYNC_PROTOCOL_VERSION,
  withArgs,
  withMultiTabSync,
  withPolling,
} from '../index';
import { Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const CHANNEL = 'multi-tab-scenario';

let tabCounter = 0;

type TabConsumer = {
  run: <T>(fn: () => T) => T;
  destroy: () => void;
};

type Tab = {
  instance: QueryClient;
  get: ReturnType<typeof createGetQuery>;
  post: ReturnType<typeof createPostQuery>;
  consumer: () => TabConsumer;
  destroy: () => void;
};

/**
 * Consumers are created below the tab's own injector, not below the TestBed root: the client token is
 * `providedIn: 'root'`, so a query created anywhere else would resolve a second, root-owned instance
 * of the same client instead of this tab's.
 */
const createTab = (s: Scenario, config: false | QueryMultiTabSyncConfig = { channelName: CHANNEL }): Tab => {
  const ref: QueryClientRef = createQueryClient({
    name: `multi-tab-scenario-tab-${++tabCounter}`,
    baseUrl: BASE_URL,
    keepUnusedFor: 0,
    features: config === false ? [] : [withMultiTabSync(config)],
  });

  const injector = createEnvironmentInjector(
    ref.provide(),
    s.run(() => inject(EnvironmentInjector)),
  );
  const instance = injector.runInContext(() => ref.inject());

  if (!instance) throw new Error('multi-tab scenario: failed to create tab client');

  const consumers = new Set<EnvironmentInjector>();

  return {
    instance,
    get: createGetQuery(ref),
    post: createPostQuery(ref),
    consumer: () => {
      const consumerInjector = createEnvironmentInjector([], injector);

      consumers.add(consumerInjector);

      return {
        run: (fn) => consumerInjector.runInContext(fn),
        destroy: () => {
          consumers.delete(consumerInjector);
          consumerInjector.destroy();
        },
      };
    },
    destroy: () => {
      for (const consumerInjector of Array.from(consumers)) {
        consumers.delete(consumerInjector);
        consumerInjector.destroy();
      }

      injector.destroy();
    },
  };
};

describe('multi-tab sync scenario', () => {
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

  const scenario = useScenario({
    baseUrl: BASE_URL,
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withMultiTabSync({ channelName: CHANNEL })],
  });

  it('shows a response that landed in one tab in another without a second request', async () => {
    const s = scenario();
    let calls = 0;
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'], v: ++calls } }));

    const getPlayer = s.get<{ response: { id: string; v: number }; pathParams: { id: string } }>(
      (p) => `/players/${p.id}`,
    );

    const tabB = createTab(s);
    const getPlayerB = tabB.get<{ response: { id: string; v: number }; pathParams: { id: string } }>(
      (p) => `/players/${p.id}`,
    );

    const a = s.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    const queryB = b.run(() => getPlayerB(withArgs(() => ({ pathParams: { id: '1' } }))));

    await s.settle();
    await flushMultiTabSync();
    expect(s.api.requestCount('GET', '/players/1')).toBe(2);

    queryA.execute();
    await s.settle();
    await flushMultiTabSync();

    expect(s.api.requestCount('GET', '/players/1')).toBe(3);
    expect(queryB.response()).toEqual({ id: '1', v: 3 });

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('shares freshness, so an allowCache execute in the other tab serves the shared response', async () => {
    const s = scenario();
    let fresh = false;
    s.api.on('GET', '/report', () => ({
      body: { n: fresh ? 2 : 1 },
      headers: fresh ? { 'cache-control': 'max-age=600' } : undefined,
    }));

    const getReport = s.get<{ response: { n: number } }>('/report');
    const tabB = createTab(s);
    const getReportB = tabB.get<{ response: { n: number } }>('/report');

    const a = s.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getReport());
    const queryB = b.run(() => getReportB());

    await s.settle();
    await flushMultiTabSync();
    expect(s.api.requestCount('GET', '/report')).toBe(2);

    fresh = true;
    queryA.execute();
    await s.settle();
    await flushMultiTabSync();

    queryB.execute({ options: { allowCache: true } });
    await s.settle();

    expect(queryB.response()).toEqual({ n: 2 });
    expect(s.api.requestCount('GET', '/report')).toBe(3);

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('does not receive the other tab response for a query that opted out with multiTabSync: false', async () => {
    const s = scenario();
    s.api.on('GET', '/exports/full', () => ({ body: { rows: 1 } }));

    const getExport = s.get<{ response: { rows: number } }>('/exports/full', { multiTabSync: false });
    const tabB = createTab(s);
    const getExportB = tabB.get<{ response: { rows: number } }>('/exports/full', { multiTabSync: false });

    const a = s.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getExport());
    const queryB = b.run(() => getExportB());

    await s.settle();
    await flushMultiTabSync();
    expect(s.api.requestCount('GET', '/exports/full')).toBe(2);

    queryA.execute();
    await s.settle();
    await flushMultiTabSync();

    expect(s.api.requestCount('GET', '/exports/full')).toBe(3);
    expect(queryB.response()).toEqual({ rows: 1 });
    expect(bus.posted).toEqual([]);

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('does not broadcast a cached POST response to the other tab', async () => {
    const s = scenario();
    let issued = 0;
    s.api.on('POST', '/auth/login', () => ({ body: { accessToken: `token-${++issued}` } }));

    type Login = { body: { user: string }; response: { accessToken: string } };
    const cachedPost = { subtle: { useQueryRepositoryCache: true } };

    const login = s.post<Login>('/auth/login', cachedPost);
    const tabB = createTab(s);
    const loginB = tabB.post<Login>('/auth/login', cachedPost);

    const a = s.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => login());
    const queryB = b.run(() => loginB());

    queryB.execute({ args: { body: { user: 'alice' } } });
    await s.settle();
    await flushMultiTabSync();

    expect(queryB.response()).toEqual({ accessToken: 'token-1' });

    queryA.execute({ args: { body: { user: 'alice' } } });
    await s.settle();
    await flushMultiTabSync();

    expect(queryA.response()).toEqual({ accessToken: 'token-2' });
    expect(queryB.response()).toEqual({ accessToken: 'token-1' });
    expect(bus.posted).toEqual([]);

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('refreshes the other tab after a mutation, but leaves the mutating tab alone', async () => {
    const s = scenario();
    let version = 1;
    s.api.on('GET', '/players', () => ({ body: { version } }));
    s.api.on('POST', '/players', () => ({ status: 201, body: { created: true } }));

    const getPlayers = s.get<{ response: { version: number } }>('/players');
    const createPlayer = s.post<{ body: { name: string }; response: { created: boolean } }>('/players');

    const tabB = createTab(s);
    const getPlayersB = tabB.get<{ response: { version: number } }>('/players');

    const a = s.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getPlayers());
    const queryB = b.run(() => getPlayersB());

    await s.settle();
    await flushMultiTabSync();

    version = 2;
    const mutation = a.run(() => createPlayer());
    mutation.execute({ args: { body: { name: 'Alice' } } });
    s.tick();
    await flushMultiTabSync();

    expect(queryB.loading()).not.toBeNull();
    expect(queryA.loading()).toBeNull();

    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(queryB.response()).toEqual({ version: 2 });

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('propagates an explicit invalidateQueries call to the other tab, and refreshes the calling tab too', async () => {
    const s = scenario();
    let version = 1;
    s.api.on('GET', '/teams/:id', ({ params }) => ({ body: { id: params['id'], v: version } }));

    const getTeam = s.get<{ response: { id: string; v: number }; pathParams: { id: string } }>((p) => `/teams/${p.id}`);
    const tabB = createTab(s);
    const getTeamB = tabB.get<{ response: { id: string; v: number }; pathParams: { id: string } }>(
      (p) => `/teams/${p.id}`,
    );

    const a = s.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getTeam(withArgs(() => ({ pathParams: { id: '9' } }))));
    const queryB = b.run(() => getTeamB(withArgs(() => ({ pathParams: { id: '9' } }))));

    await s.settle();
    await flushMultiTabSync();

    version = 2;
    s.client.invalidateQueries({ url: '/teams' });
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(queryA.response()).toEqual({ id: '9', v: 2 });
    expect(queryB.response()).toEqual({ id: '9', v: 2 });

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('keeps an invalidation local when otherTabs is false', async () => {
    const s = scenario();
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getPlayer = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);
    const tabB = createTab(s);
    const getPlayerB = tabB.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);

    const a = s.consumer();
    const b = tabB.consumer();
    a.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '3' } }))));
    const queryB = b.run(() => getPlayerB(withArgs(() => ({ pathParams: { id: '3' } }))));

    await s.settle();
    await flushMultiTabSync();

    s.client.invalidateQueries({ url: '/players', otherTabs: false });
    await s.settle();

    expect(queryB.loading()).toBeNull();
    expect(s.api.requestCount('GET', '/players/3')).toBe(3);

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('does not broadcast a response body the structured clone algorithm cannot handle', async () => {
    const s = scenario();
    let broken = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s.api.on('GET', '/broken-body', () => (broken ? { body: { fn: (() => undefined) as any } } : { body: { v: 1 } }));

    const getBroken = s.get<{ response: { fn?: () => void; v?: number } }>('/broken-body');
    const tabB = createTab(s);
    const getBrokenB = tabB.get<{ response: { fn?: () => void; v?: number } }>('/broken-body');

    const a = s.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getBroken());
    const queryB = b.run(() => getBrokenB());

    await s.settle();
    await flushMultiTabSync();
    expect(queryB.response()).toEqual({ v: 1 });

    const postedBefore = bus.posted.length;
    broken = true;
    queryA.execute();
    await s.settle();
    await flushMultiTabSync();

    expect(queryA.response()).toEqual({ fn: expect.any(Function) });
    expect(queryB.response()).toEqual({ v: 1 });
    expect(bus.posted.length).toBe(postedBefore);
    expect(s.errors).toEqual([]);

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('polls one cache key in one tab only, the other receiving the data through response sharing', async () => {
    const s = scenario();
    let n = 0;
    s.api.on('GET', '/scoreboard', () => ({ body: { n: ++n } }));

    const getScoreboard = s.get<{ response: { n: number } }>('/scoreboard');
    const tabB = createTab(s);
    const getScoreboardB = tabB.get<{ response: { n: number } }>('/scoreboard');

    const a = s.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getScoreboard(withPolling({ interval: 10_000 })));
    const queryB = b.run(() => getScoreboardB(withPolling({ interval: 10_000 })));

    await s.settle();
    await flushMultiTabSync();
    const requestsAfterMount = s.api.requestCount('GET', '/scoreboard');

    s.tick(10_000);
    s.tick(1);
    await flushMultiTabSync();
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(s.api.requestCount('GET', '/scoreboard')).toBe(requestsAfterMount + 1);
    expect(queryA.response()).toEqual(queryB.response());

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('does not open a channel or request a lock without the feature', async () => {
    const s = scenario();
    s.api.on('GET', '/solo', () => ({ body: { ok: true } }));

    const tab = createTab(s, false);
    const getSolo = tab.get<{ response: { ok: boolean } }>('/solo');

    const postedBefore = bus.posted.length;
    const c = tab.consumer();
    c.run(() => getSolo(withPolling({ interval: 10_000 })));
    await s.settle();

    expect(bus.posted.length).toBe(postedBefore);
    expect(locks.heldNames()).toEqual([]);
    expect(locks.pendingNames()).toEqual([]);

    c.destroy();
    tab.destroy();
  });

  it('never seeds a cold key: a tab that never mounted the query gets no cache entry from the broadcast', async () => {
    const s = scenario();
    s.api.on('GET', '/cold/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getCold = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/cold/${p.id}`);
    const tabB = createTab(s);
    const getColdB = tabB.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/cold/${p.id}`);

    const warm = tabB.consumer();
    warm.run(() => getColdB(withArgs(() => ({ pathParams: { id: '2' } }))));
    await s.settle();

    expect(tabB.instance.repository.subtle.cacheEntries().length).toBe(1);

    warm.destroy();
    await s.settle();

    expect(tabB.instance.repository.subtle.cacheEntries()).toEqual([]);

    const a = s.consumer();
    a.run(() => getCold(withArgs(() => ({ pathParams: { id: '1' } }))));

    await s.settle();
    await flushMultiTabSync();

    expect(tabB.instance.repository.subtle.cacheEntries()).toEqual([]);

    a.destroy();
    tabB.destroy();
  });

  it('ignores a shared response while its own request is in flight', async () => {
    const s = scenario();
    let version = 0;
    s.api.on('GET', '/in-flight', () => ({ body: { version: ++version }, delay: version === 1 ? 0 : 500 }));

    const getInFlight = s.get<{ response: { version: number } }>('/in-flight');
    const c = s.consumer();
    const query = c.run(() => getInFlight());
    await s.settle();

    const key = query.id();
    if (!key) throw new Error('expected a repository key');

    query.execute();
    const probe = new BroadcastChannel(CHANNEL);
    probe.postMessage({
      v: QUERY_SYNC_PROTOCOL_VERSION,
      type: 'response',
      key,
      body: { version: 99 },
      expiresAt: null,
    });
    await flushMultiTabSync();

    expect(query.response()).toEqual({ version: 1 });

    s.tick(500);
    expect(query.response()).toEqual({ version: 2 });

    probe.close();
    c.destroy();
  });

  it('ignores messages from a different protocol version', async () => {
    const s = scenario();
    s.api.on('GET', '/versioned', () => ({ body: { version: 1 } }));

    const getVersioned = s.get<{ response: { version: number } }>('/versioned');
    const c = s.consumer();
    const query = c.run(() => getVersioned());
    await s.settle();

    const key = query.id();
    if (!key) throw new Error('expected a repository key');

    const probe = new BroadcastChannel(CHANNEL);
    probe.postMessage({
      v: QUERY_SYNC_PROTOCOL_VERSION + 1,
      type: 'response',
      key,
      body: { version: 99 },
      expiresAt: null,
    });
    await flushMultiTabSync();

    expect(query.response()).toEqual({ version: 1 });

    probe.close();
    c.destroy();
  });

  it('sends one request per cache key when a mutation refreshes several consumers of the same query', async () => {
    const s = scenario();
    let version = 1;
    s.api.on('GET', '/players', () => ({ body: { version } }));
    s.api.on('POST', '/players', () => ({ status: 201, body: { created: true } }));

    const createPlayer = s.post<{ body: { name: string }; response: { created: boolean } }>('/players');

    const tabB = createTab(s);
    const getPlayersB = tabB.get<{ response: { version: number } }>('/players');

    const a = s.consumer();
    const b1 = tabB.consumer();
    const b2 = tabB.consumer();
    const queryB1 = b1.run(() => getPlayersB());
    const queryB2 = b2.run(() => getPlayersB());

    await s.settle();
    await flushMultiTabSync();

    const requestsAfterMount = s.api.requestCount('GET', '/players');

    version = 2;
    const mutation = a.run(() => createPlayer());
    mutation.execute({ args: { body: { name: 'Alice' } } });
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(s.api.requestCount('GET', '/players')).toBe(requestsAfterMount + 1);
    expect(queryB1.response()).toEqual({ version: 2 });
    expect(queryB2.response()).toEqual({ version: 2 });

    a.destroy();
    b1.destroy();
    b2.destroy();
    tabB.destroy();
  });

  it('sends only the resolved url over the channel, so the other tab invalidates a superset of a filtered invalidation', async () => {
    const s = scenario();
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getPlayer = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);
    const tabB = createTab(s);
    const getPlayerB = tabB.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);

    const a = s.consumer();
    const b = tabB.consumer();
    a.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    a.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '2' } }))));
    b.run(() => getPlayerB(withArgs(() => ({ pathParams: { id: '1' } }))));
    b.run(() => getPlayerB(withArgs(() => ({ pathParams: { id: '2' } }))));

    await s.settle();
    await flushMultiTabSync();

    const firstBefore = s.api.requestCount('GET', '/players/1');
    const secondBefore = s.api.requestCount('GET', '/players/2');
    const postedBefore = bus.posted.length;

    s.client.invalidateQueries({ url: '/players', filter: (query) => query.url.endsWith('/1') });
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    const invalidations = bus.posted
      .slice(postedBefore)
      .map((message) => message.data)
      .filter((data) => (data as { type: string }).type === 'invalidate');

    expect(invalidations).toEqual([{ v: QUERY_SYNC_PROTOCOL_VERSION, type: 'invalidate', url: `${BASE_URL}/players` }]);
    expect(s.api.requestCount('GET', '/players/1')).toBe(firstBefore + 2);
    expect(s.api.requestCount('GET', '/players/2')).toBe(secondBefore + 1);

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('drops a shared response that arrives after a logout tore the secure entry down', async () => {
    const s = scenario();
    const auth = s.auth();

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const query = c.run(() => getSecureProfile());
    await s.settle();
    await flushMultiTabSync();

    const key = query.id();
    if (!key) throw new Error('expected a repository key');

    expect(query.response()).toEqual({ id: 'me' });

    s.run(() => auth.logout());
    await s.settle();

    expect(query.response()).toBeNull();
    expect(s.client.repository.subtle.cacheEntries().filter((entry) => entry.isSecure)).toEqual([]);

    const probe = new BroadcastChannel(CHANNEL);
    probe.postMessage({
      v: QUERY_SYNC_PROTOCOL_VERSION,
      type: 'response',
      key,
      body: { id: 'from-the-other-tab' },
      expiresAt: null,
    });
    await flushMultiTabSync();
    await s.settle();

    expect(query.response()).toBeNull();
    expect(s.client.repository.subtle.cacheEntries().filter((entry) => entry.key === key)).toEqual([]);

    probe.close();
    c.destroy();
  });

  it('logs a dev-mode warning for a response body it cannot structured-clone', async () => {
    const s = scenario();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s.api.on('GET', '/unshareable', () => ({ body: { fn: (() => undefined) as any } }));

    const getUnshareable = s.get<{ response: { fn: () => void } }>('/unshareable');
    const tabB = createTab(s);
    const getUnshareableB = tabB.get<{ response: { fn: () => void } }>('/unshareable');

    const a = s.consumer();
    const b = tabB.consumer();
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map((arg) => String(arg)).join(' '));
    };

    try {
      a.run(() => getUnshareable());
      b.run(() => getUnshareableB());

      await s.settle();
      await flushMultiTabSync();
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings.filter((warning) => warning.includes(CHANNEL)).length).toBeGreaterThan(0);
    expect(bus.posted).toEqual([]);
    expect(s.errors).toEqual([]);

    a.destroy();
    b.destroy();
    tabB.destroy();
  });

  it('never delivers a broadcast back to the tab that posted it, and never delivers synchronously', async () => {
    const sender = new BroadcastChannel(`${CHANNEL}-delivery`);
    const receiver = new BroadcastChannel(`${CHANNEL}-delivery`);
    const bystander = new BroadcastChannel(`${CHANNEL}-delivery-other`);

    const senderSaw: unknown[] = [];
    const receiverSaw: unknown[] = [];
    const bystanderSaw: unknown[] = [];

    sender.onmessage = (event) => senderSaw.push(event.data);
    receiver.onmessage = (event) => receiverSaw.push(event.data);
    bystander.onmessage = (event) => bystanderSaw.push(event.data);

    sender.postMessage({ hello: 'world' });

    expect(receiverSaw).toEqual([]);

    await flushMultiTabSync();

    expect(receiverSaw).toEqual([{ hello: 'world' }]);
    expect(senderSaw).toEqual([]);
    expect(bystanderSaw).toEqual([]);

    sender.close();
    receiver.close();
    bystander.close();
  });

  it('leaves no open channel port and no timer once both tabs are destroyed', async () => {
    const s = scenario();
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getPlayer = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);
    const tabB = createTab(s);
    const getPlayerB = tabB.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);

    const a = s.consumer();
    const b = tabB.consumer();
    a.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '5' } }))));
    b.run(() => getPlayerB(withArgs(() => ({ pathParams: { id: '5' } }))));

    await s.settle();
    await flushMultiTabSync();

    a.destroy();
    b.destroy();
    tabB.destroy();

    const postedBeforeProbe = bus.posted.length;
    const probe = new BroadcastChannel(CHANNEL);
    probe.postMessage({ probe: true });
    await flushMultiTabSync();
    probe.close();

    expect(bus.posted.length).toBe(postedBeforeProbe + 1);
    expect(locks.heldNames()).toEqual([]);
    expect(locks.pendingNames()).toEqual([]);
  });
});
