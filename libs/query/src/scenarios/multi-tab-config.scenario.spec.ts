import { createEnvironmentInjector, EnvironmentInjector, inject, PLATFORM_ID, Provider } from '@angular/core';
import {
  createFakeQueryPersistenceStore,
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDeleteQuery,
  createGetQuery,
  createPatchQuery,
  createPostQuery,
  createPutQuery,
  createQueryClient,
  QueryClient,
  QueryClientFeatureFn,
  QueryClientRef,
  QueryMultiTabSyncConfig,
  withMultiTabSync,
  withPolling,
  withQueryPersistence,
  withSuccessHandling,
} from '../index';
import { Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const CHANNEL = 'multi-tab-config-scenario';

let tabCounter = 0;

type TabConsumer = {
  run: <T>(fn: () => T) => T;
  destroy: () => void;
};

type Tab = {
  name: string;
  instance: QueryClient;
  get: ReturnType<typeof createGetQuery>;
  post: ReturnType<typeof createPostQuery>;
  put: ReturnType<typeof createPutQuery>;
  patch: ReturnType<typeof createPatchQuery>;
  delete: ReturnType<typeof createDeleteQuery>;
  consumer: () => TabConsumer;
  destroy: () => void;
};

type TabOptions = {
  sync?: false | QueryMultiTabSyncConfig;
  keepUnusedFor?: number;
  features?: QueryClientFeatureFn[];
  providers?: Provider[];
};

/**
 * Consumers are created below the tab's own injector, not below the TestBed root: the client token is
 * `providedIn: 'root'`, so a query created anywhere else would resolve a second, root-owned instance
 * of the same client instead of this tab's.
 */
const createTab = (s: Scenario, options: TabOptions = {}): Tab => {
  const syncConfig = options.sync === undefined ? { channelName: CHANNEL } : options.sync;

  const name = `multi-tab-config-tab-${++tabCounter}`;

  const ref: QueryClientRef = createQueryClient({
    name,
    baseUrl: BASE_URL,
    keepUnusedFor: options.keepUnusedFor ?? 0,
    features: [
      ...(syncConfig === false ? [] : [withMultiTabSync(syncConfig)]),
      ...(options.features ?? []),
    ] as QueryClientFeatureFn[],
  });

  const injector = createEnvironmentInjector(
    [...ref.provide(), ...(options.providers ?? [])],
    s.run(() => inject(EnvironmentInjector)),
  );
  const instance = injector.runInContext(() => ref.inject());

  if (!instance) throw new Error('multi-tab config scenario: failed to create tab client');

  const consumers = new Set<EnvironmentInjector>();

  return {
    name,
    instance,
    get: createGetQuery(ref),
    post: createPostQuery(ref),
    put: createPutQuery(ref),
    patch: createPatchQuery(ref),
    delete: createDeleteQuery(ref),
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

const lockStateOf = (tab: Tab, key: string) => tab.instance.subtle.sync?.lockManager.keyStates()[key] ?? null;

const pollTick = async (s: Scenario, interval: number) => {
  s.tick(interval);
  s.tick(1);
  await flushMultiTabSync();
  await s.settle();
  await flushMultiTabSync();
  await s.settle();
};

describe('multi-tab sync configuration scenario', () => {
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

  it('updates an entry that is sitting out its keepUnusedFor window, so a rebind renders the newer body', async () => {
    const s = scenario();
    let version = 0;
    s.api.on('GET', '/retained', () => ({ body: { v: ++version }, headers: { 'cache-control': 'max-age=600' } }));

    const tabA = createTab(s);
    const tabB = createTab(s, { keepUnusedFor: 60_000 });
    const getRetainedA = tabA.get<{ response: { v: number } }>('/retained');
    const getRetainedB = tabB.get<{ response: { v: number } }>('/retained');

    const a = tabA.consumer();
    const b1 = tabB.consumer();
    const queryA = a.run(() => getRetainedA());
    b1.run(() => getRetainedB());

    await s.settle();
    await flushMultiTabSync();
    expect(s.api.requestCount('GET', '/retained')).toBe(2);

    b1.destroy();
    await s.settle();

    queryA.execute();
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    const requestsBeforeRebind = s.api.requestCount('GET', '/retained');

    const b2 = tabB.consumer();
    const rebound = b2.run(() => getRetainedB({ onlyManualExecution: true }));

    rebound.execute({ options: { allowCache: true } });
    await s.settle();

    expect(rebound.response()).toEqual({ v: 3 });
    expect(s.api.requestCount('GET', '/retained')).toBe(requestsBeforeRebind);

    a.destroy();
    b2.destroy();

    // The evict timer of a retained entry outlives the client's injector, so the window has to elapse
    // before the tab is torn down or the scenario reports a leaked timer.
    s.tick(60_000);
    s.tick(1);

    tabA.destroy();
    tabB.destroy();
  });

  it('does not write a response it adopted from the other tab to its own persisted store', async () => {
    const s = scenario();
    let version = 0;
    s.api.on('GET', '/persisted', () => ({ body: { v: ++version } }));

    const storeA = createFakeQueryPersistenceStore();
    const storeB = createFakeQueryPersistenceStore();

    const tabA = createTab(s, { features: [withQueryPersistence({ adapter: () => storeA.adapter })] });
    const tabB = createTab(s, { features: [withQueryPersistence({ adapter: () => storeB.adapter })] });
    const getPersistedA = tabA.get<{ response: { v: number } }>('/persisted');
    const getPersistedB = tabB.get<{ response: { v: number } }>('/persisted');

    const a = tabA.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getPersistedA());
    const queryB = b.run(() => getPersistedB());

    await s.settle();
    await flushMultiTabSync();
    await tabA.instance.subtle.persistence?.flush();
    await tabB.instance.subtle.persistence?.flush();
    await s.settle();

    const key = queryA.id();
    if (!key) throw new Error('expected a repository key');

    expect(storeA.entry(key)?.body).toEqual({ v: 1 });
    expect(storeB.entry(key)?.body).toEqual({ v: 2 });

    queryA.execute();
    await s.settle();
    await flushMultiTabSync();
    await s.settle();
    await tabA.instance.subtle.persistence?.flush();
    await tabB.instance.subtle.persistence?.flush();
    await s.settle();

    expect(queryA.response()).toEqual({ v: 3 });
    expect(queryB.response()).toEqual({ v: 3 });
    expect(storeA.entry(key)?.body).toEqual({ v: 3 });
    expect(storeB.entry(key)?.body).toEqual({ v: 2 });

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('shares nothing and dedupes no poll with syncResponses: false', async () => {
    const s = scenario();
    let version = 0;
    s.api.on('GET', '/unshared', () => ({ body: { v: ++version } }));

    const tabA = createTab(s, { sync: { channelName: CHANNEL, syncResponses: false } });
    const tabB = createTab(s, { sync: { channelName: CHANNEL, syncResponses: false } });
    const getUnsharedA = tabA.get<{ response: { v: number } }>('/unshared');
    const getUnsharedB = tabB.get<{ response: { v: number } }>('/unshared');

    const a = tabA.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getUnsharedA(withPolling({ interval: 10_000 })));
    const queryB = b.run(() => getUnsharedB(withPolling({ interval: 10_000 })));

    await s.settle();
    await flushMultiTabSync();

    const requestsAfterMount = s.api.requestCount('GET', '/unshared');
    const responseBBeforePoll = queryB.response();

    await pollTick(s, 10_000);

    expect(s.api.requestCount('GET', '/unshared')).toBe(requestsAfterMount + 2);
    expect(queryB.response()).not.toEqual(responseBBeforePoll);
    expect(queryA.response()).not.toEqual(queryB.response());
    expect(bus.posted).toEqual([]);
    expect(locks.heldNames()).toEqual([]);

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('keeps sharing responses but lets every tab poll with dedupePolling: false', async () => {
    const s = scenario();
    let polls = 0;
    let reports = 0;
    s.api.on('GET', '/polled', () => ({ body: { n: ++polls } }));
    s.api.on('GET', '/report', () => ({ body: { n: ++reports } }));

    const tabA = createTab(s, { sync: { channelName: CHANNEL, dedupePolling: false } });
    const tabB = createTab(s, { sync: { channelName: CHANNEL, dedupePolling: false } });
    const getPolledA = tabA.get<{ response: { n: number } }>('/polled');
    const getPolledB = tabB.get<{ response: { n: number } }>('/polled');
    const getReportA = tabA.get<{ response: { n: number } }>('/report');
    const getReportB = tabB.get<{ response: { n: number } }>('/report');

    const a = tabA.consumer();
    const b = tabB.consumer();
    a.run(() => getPolledA(withPolling({ interval: 10_000 })));
    b.run(() => getPolledB(withPolling({ interval: 10_000 })));
    const reportA = a.run(() => getReportA());
    const reportB = b.run(() => getReportB());

    await s.settle();
    await flushMultiTabSync();

    const requestsAfterMount = s.api.requestCount('GET', '/polled');

    await pollTick(s, 10_000);

    expect(s.api.requestCount('GET', '/polled')).toBe(requestsAfterMount + 2);
    expect(locks.heldNames()).toEqual([]);
    expect(locks.pendingNames()).toEqual([]);

    reportA.execute();
    await s.settle();
    await flushMultiTabSync();

    expect(reportB.response()).toEqual(reportA.response());

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('stops the mutation-driven refresh with refreshOnMutation: false, but not an explicit invalidation', async () => {
    const s = scenario();
    let version = 1;
    s.api.on('GET', '/players', () => ({ body: { version } }));
    s.api.on('POST', '/players', () => ({ status: 201, body: { created: true } }));

    const tabA = createTab(s, { sync: { channelName: CHANNEL, refreshOnMutation: false } });
    const tabB = createTab(s, { sync: { channelName: CHANNEL, refreshOnMutation: false } });
    const getPlayersA = tabA.get<{ response: { version: number } }>('/players');
    const getPlayersB = tabB.get<{ response: { version: number } }>('/players');
    const createPlayer = tabA.post<{ body: { name: string }; response: { created: boolean } }>('/players');

    const a = tabA.consumer();
    const b = tabB.consumer();
    a.run(() => getPlayersA());
    const queryB = b.run(() => getPlayersB());

    await s.settle();
    await flushMultiTabSync();

    const requestsAfterMount = s.api.requestCount('GET', '/players');

    version = 2;
    const mutation = a.run(() => createPlayer());
    mutation.execute({ args: { body: { name: 'Alice' } } });
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(s.api.requestCount('GET', '/players')).toBe(requestsAfterMount);
    expect(queryB.response()).toEqual({ version: 1 });

    tabA.instance.invalidateQueries({ url: '/players' });
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(queryB.response()).toEqual({ version: 2 });

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('refreshes only what the refreshOnMutation filter accepts, for every mutating method', async () => {
    const s = scenario();
    s.api.on('GET', '/players', () => ({ body: { ok: true } }));
    s.api.on('GET', '/teams', () => ({ body: { ok: true } }));
    s.api.on('POST', '/players', () => ({ status: 201, body: { ok: true } }));
    s.api.on('PUT', '/players/1', () => ({ body: { ok: true } }));
    s.api.on('PATCH', '/players/1', () => ({ body: { ok: true } }));
    s.api.on('DELETE', '/players/1', () => ({ body: { ok: true } }));

    const sync: QueryMultiTabSyncConfig = {
      channelName: CHANNEL,
      refreshOnMutation: { filter: (_mutation, query) => new URL(query.url).pathname.startsWith('/players') },
    };

    const tabA = createTab(s, { sync });
    const tabB = createTab(s, { sync });
    const getPlayersB = tabB.get<{ response: { ok: boolean } }>('/players');
    const getTeamsB = tabB.get<{ response: { ok: boolean } }>('/teams');
    const createPlayer = tabA.post<{ body: { name: string }; response: { ok: boolean } }>('/players');
    const replacePlayer = tabA.put<{ body: { name: string }; response: { ok: boolean } }>('/players/1');
    const patchPlayer = tabA.patch<{ body: { name: string }; response: { ok: boolean } }>('/players/1');
    const removePlayer = tabA.delete<{ response: { ok: boolean } }>('/players/1');

    const a = tabA.consumer();
    const b = tabB.consumer();
    b.run(() => getPlayersB());
    b.run(() => getTeamsB());

    await s.settle();
    await flushMultiTabSync();

    expect(s.api.requestCount('GET', '/players')).toBe(1);
    expect(s.api.requestCount('GET', '/teams')).toBe(1);

    const runMutation = async (execute: () => void) => {
      execute();
      await s.settle();
      await flushMultiTabSync();
      await s.settle();
    };

    await runMutation(() => a.run(() => createPlayer()).execute({ args: { body: { name: 'a' } } }));
    expect(s.api.requestCount('GET', '/players')).toBe(2);

    await runMutation(() => a.run(() => replacePlayer()).execute({ args: { body: { name: 'b' } } }));
    expect(s.api.requestCount('GET', '/players')).toBe(3);

    await runMutation(() => a.run(() => patchPlayer()).execute({ args: { body: { name: 'c' } } }));
    expect(s.api.requestCount('GET', '/players')).toBe(4);

    await runMutation(() => a.run(() => removePlayer()).execute());
    expect(s.api.requestCount('GET', '/players')).toBe(5);

    expect(s.api.requestCount('GET', '/teams')).toBe(1);

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('never crosses two clients on different channel names', async () => {
    const s = scenario();
    let version = 0;
    s.api.on('GET', '/isolated', () => ({ body: { v: ++version } }));

    const tabA = createTab(s, { sync: { channelName: `${CHANNEL}-a` } });
    const tabC = createTab(s, { sync: { channelName: `${CHANNEL}-c` } });
    const getIsolatedA = tabA.get<{ response: { v: number } }>('/isolated');
    const getIsolatedC = tabC.get<{ response: { v: number } }>('/isolated');

    const a = tabA.consumer();
    const c = tabC.consumer();
    const queryA = a.run(() => getIsolatedA());
    const queryC = c.run(() => getIsolatedC());

    await s.settle();
    await flushMultiTabSync();

    const responseCAfterMount = queryC.response();

    queryA.execute();
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(queryA.response()).not.toEqual(responseCAfterMount);
    expect(queryC.response()).toEqual(responseCAfterMount);

    const requestsBeforeInvalidation = s.api.requestCount('GET', '/isolated');

    tabA.instance.invalidateQueries({ url: '/isolated' });
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(s.api.requestCount('GET', '/isolated')).toBe(requestsBeforeInvalidation + 1);
    expect(queryC.response()).toEqual(responseCAfterMount);

    a.destroy();
    c.destroy();
    tabA.destroy();
    tabC.destroy();
  });

  it('keeps side-effect features quiet in the tab that adopts a shared response', async () => {
    const s = scenario();
    let version = 0;
    s.api.on('GET', '/quiet', () => ({ body: { v: ++version } }));

    const tabA = createTab(s);
    const tabB = createTab(s);
    const getQuietA = tabA.get<{ response: { v: number } }>('/quiet');
    const getQuietB = tabB.get<{ response: { v: number } }>('/quiet');

    let successHandlerCalls = 0;

    const a = tabA.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getQuietA());
    const queryB = b.run(() => getQuietB(withSuccessHandling({ handler: () => successHandlerCalls++ })));

    await s.settle();
    await flushMultiTabSync();

    expect(successHandlerCalls).toBe(1);

    const callsAfterOwnRequest = successHandlerCalls;
    const eventAfterOwnRequest = queryB.latestHttpEvent();

    queryA.execute();
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(queryB.response()).toEqual(queryA.response());
    expect(successHandlerCalls).toBe(callsAfterOwnRequest);
    expect(queryB.latestHttpEvent()).toBe(eventAfterOwnRequest);

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('hands a poll over to the next tab in the queue when the holder goes away', async () => {
    const s = scenario();
    let n = 0;
    s.api.on('GET', '/scoreboard', () => ({ body: { n: ++n } }));

    const tabA = createTab(s);
    const tabB = createTab(s);
    const tabC = createTab(s);
    const getScoreboardA = tabA.get<{ response: { n: number } }>('/scoreboard');
    const getScoreboardB = tabB.get<{ response: { n: number } }>('/scoreboard');
    const getScoreboardC = tabC.get<{ response: { n: number } }>('/scoreboard');

    const a = tabA.consumer();
    const b = tabB.consumer();
    const c = tabC.consumer();
    const queryA = a.run(() => getScoreboardA(withPolling({ interval: 10_000 })));
    b.run(() => getScoreboardB(withPolling({ interval: 10_000 })));
    c.run(() => getScoreboardC(withPolling({ interval: 10_000 })));

    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    const key = queryA.id();
    if (!key) throw new Error('expected a repository key');

    expect(locks.heldNames().length).toBe(1);
    expect(locks.pendingNames().length).toBe(1);
    expect(lockStateOf(tabA, key)).toBe('holder');
    expect(lockStateOf(tabB, key)).toBe('standby');
    expect(lockStateOf(tabC, key)).toBe('standby');

    const requestsAfterMount = s.api.requestCount('GET', '/scoreboard');

    await pollTick(s, 10_000);

    expect(s.api.requestCount('GET', '/scoreboard')).toBe(requestsAfterMount + 1);

    a.destroy();
    tabA.destroy();
    await flushMultiTabSync();
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(lockStateOf(tabB, key)).toBe('holder');
    expect(lockStateOf(tabC, key)).toBe('standby');

    const requestsBeforeHandover = s.api.requestCount('GET', '/scoreboard');

    await pollTick(s, 10_000);

    expect(s.api.requestCount('GET', '/scoreboard')).toBe(requestsBeforeHandover + 1);

    b.destroy();
    c.destroy();
    tabB.destroy();
    tabC.destroy();
  });

  it('hands the poll over when the holding tab becomes hidden', async () => {
    const s = scenario();
    let n = 0;
    s.api.on('GET', '/hidden-handover', () => ({ body: { n: ++n } }));

    const tabA = createTab(s);
    const tabB = createTab(s);
    const getA = tabA.get<{ response: { n: number } }>('/hidden-handover');
    const getB = tabB.get<{ response: { n: number } }>('/hidden-handover');

    const a = tabA.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getA(withPolling({ interval: 10_000 })));
    b.run(() => getB(withPolling({ interval: 10_000 })));

    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    const key = queryA.id();
    if (!key) throw new Error('expected a repository key');

    expect(lockStateOf(tabA, key)).toBe('holder');

    const hiddenDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');

    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });

    try {
      document.dispatchEvent(new Event('visibilitychange'));

      await flushMultiTabSync();
      await s.settle();
      await flushMultiTabSync();
      await s.settle();

      expect(lockStateOf(tabB, key)).toBe('holder');
      expect(lockStateOf(tabA, key)).toBe('standby');

      const requestsBeforePoll = s.api.requestCount('GET', '/hidden-handover');

      await pollTick(s, 10_000);

      expect(s.api.requestCount('GET', '/hidden-handover')).toBe(requestsBeforePoll + 1);
    } finally {
      delete (document as unknown as Record<string, unknown>)['hidden'];
      delete (document as unknown as Record<string, unknown>)['visibilityState'];

      if (hiddenDescriptor) Object.defineProperty(Document.prototype, 'hidden', hiddenDescriptor);
      if (visibilityDescriptor) Object.defineProperty(Document.prototype, 'visibilityState', visibilityDescriptor);
    }

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it("polls at the holder's interval, not the standby tab's", async () => {
    const s = scenario();
    let n = 0;
    s.api.on('GET', '/rate', () => ({ body: { n: ++n } }));

    const tabA = createTab(s);
    const tabB = createTab(s);
    const getA = tabA.get<{ response: { n: number } }>('/rate');
    const getB = tabB.get<{ response: { n: number } }>('/rate');

    const a = tabA.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getA(withPolling({ interval: 5_000 })));
    b.run(() => getB(withPolling({ interval: 20_000 })));

    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    const key = queryA.id();
    if (!key) throw new Error('expected a repository key');

    expect(lockStateOf(tabA, key)).toBe('holder');

    const requestsAfterMount = s.api.requestCount('GET', '/rate');

    for (let round = 0; round < 4; round++) {
      await pollTick(s, 5_000);
    }

    expect(s.api.requestCount('GET', '/rate')).toBe(requestsAfterMount + 4);

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('keeps the standby tab polling interval running while it skips every tick', async () => {
    const s = scenario();
    let n = 0;
    s.api.on('GET', '/standby', () => ({ body: { n: ++n } }));

    const tabA = createTab(s);
    const tabB = createTab(s);
    const getA = tabA.get<{ response: { n: number } }>('/standby');
    const getB = tabB.get<{ response: { n: number } }>('/standby');

    const a = tabA.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getA(withPolling({ interval: 10_000 })));
    b.run(() => getB(withPolling({ interval: 10_000 })));

    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    const key = queryA.id();
    if (!key) throw new Error('expected a repository key');

    expect(lockStateOf(tabA, key)).toBe('holder');
    expect(lockStateOf(tabB, key)).toBe('standby');

    const requestsAfterMount = s.api.requestCount('GET', '/standby');

    await pollTick(s, 10_000);

    expect(s.api.requestCount('GET', '/standby')).toBe(requestsAfterMount + 1);

    await pollTick(s, 5_000);

    expect(s.api.requestCount('GET', '/standby')).toBe(requestsAfterMount + 1);

    a.destroy();
    tabA.destroy();
    await flushMultiTabSync();
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(lockStateOf(tabB, key)).toBe('holder');

    const requestsBeforeHandover = s.api.requestCount('GET', '/standby');

    // Half an interval after the handover, so the tick that lands here can only be the one the standby
    // tab kept running: an interval restarted on becoming holder would fire five seconds later.
    await pollTick(s, 5_000);

    expect(s.api.requestCount('GET', '/standby')).toBe(requestsBeforeHandover + 1);

    b.destroy();
    tabB.destroy();
  });

  it('elects a holder per cache key, so two tabs each poll a different key', async () => {
    const s = scenario();
    let alpha = 0;
    let beta = 0;
    s.api.on('GET', '/alpha', () => ({ body: { n: ++alpha } }));
    s.api.on('GET', '/beta', () => ({ body: { n: ++beta } }));

    const tabA = createTab(s);
    const tabB = createTab(s);
    const getAlphaA = tabA.get<{ response: { n: number } }>('/alpha');
    const getBetaA = tabA.get<{ response: { n: number } }>('/beta');
    const getAlphaB = tabB.get<{ response: { n: number } }>('/alpha');
    const getBetaB = tabB.get<{ response: { n: number } }>('/beta');

    const a = tabA.consumer();
    const b = tabB.consumer();

    const alphaA = a.run(() => getAlphaA(withPolling({ interval: 10_000 })));
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    const betaB = b.run(() => getBetaB(withPolling({ interval: 10_000 })));
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    a.run(() => getBetaA(withPolling({ interval: 10_000 })));
    b.run(() => getAlphaB(withPolling({ interval: 10_000 })));
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    const alphaKey = alphaA.id();
    const betaKey = betaB.id();
    if (!alphaKey || !betaKey) throw new Error('expected a repository key');

    expect(lockStateOf(tabA, alphaKey)).toBe('holder');
    expect(lockStateOf(tabB, alphaKey)).toBe('standby');
    expect(lockStateOf(tabB, betaKey)).toBe('holder');
    expect(lockStateOf(tabA, betaKey)).toBe('standby');

    const alphaBefore = s.api.requestCount('GET', '/alpha');
    const betaBefore = s.api.requestCount('GET', '/beta');

    await pollTick(s, 10_000);

    expect(s.api.requestCount('GET', '/alpha')).toBe(alphaBefore + 1);
    expect(s.api.requestCount('GET', '/beta')).toBe(betaBefore + 1);

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('hands the lock straight back to a hidden tab when no other tab wants the key', async () => {
    const s = scenario();
    let n = 0;
    s.api.on('GET', '/lonely-poll', () => ({ body: { n: ++n } }));

    const tabA = createTab(s);
    const tabB = createTab(s);
    const getA = tabA.get<{ response: { n: number } }>('/lonely-poll');

    const a = tabA.consumer();
    const queryA = a.run(() => getA(withPolling({ interval: 10_000 })));

    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    const key = queryA.id();
    if (!key) throw new Error('expected a repository key');

    expect(lockStateOf(tabA, key)).toBe('holder');

    const hiddenDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');

    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });

    try {
      document.dispatchEvent(new Event('visibilitychange'));

      expect(lockStateOf(tabA, key)).toBe('standby');

      await flushMultiTabSync();
      await s.settle();
      await flushMultiTabSync();
      await s.settle();

      expect(lockStateOf(tabA, key)).toBe('holder');
      expect(locks.pendingNames()).toEqual([]);

      const requestsBeforePoll = s.api.requestCount('GET', '/lonely-poll');

      await pollTick(s, 10_000);

      expect(s.api.requestCount('GET', '/lonely-poll')).toBe(requestsBeforePoll + 1);
    } finally {
      delete (document as unknown as Record<string, unknown>)['hidden'];
      delete (document as unknown as Record<string, unknown>)['visibilityState'];

      if (hiddenDescriptor) Object.defineProperty(Document.prototype, 'hidden', hiddenDescriptor);
      if (visibilityDescriptor) Object.defineProperty(Document.prototype, 'visibilityState', visibilityDescriptor);
    }

    a.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('refreshes only the other tab in-use entries after a mutation, leaving a consumer-less cache entry alone', async () => {
    const s = scenario();
    s.api.on('GET', '/players', () => ({ body: { ok: true } }));
    s.api.on('GET', '/teams', () => ({ body: { ok: true } }));
    s.api.on('POST', '/players', () => ({ status: 201, body: { ok: true } }));

    const tabA = createTab(s);
    const tabB = createTab(s, { keepUnusedFor: 60_000 });
    const getPlayersB = tabB.get<{ response: { ok: boolean } }>('/players');
    const getTeamsB = tabB.get<{ response: { ok: boolean } }>('/teams');
    const createPlayer = tabA.post<{ body: { name: string }; response: { ok: boolean } }>('/players');

    const a = tabA.consumer();
    const watched = tabB.consumer();
    const abandoned = tabB.consumer();
    watched.run(() => getPlayersB());
    abandoned.run(() => getTeamsB());

    await s.settle();
    await flushMultiTabSync();

    expect(s.api.requestCount('GET', '/players')).toBe(1);
    expect(s.api.requestCount('GET', '/teams')).toBe(1);

    abandoned.destroy();
    await s.settle();

    expect(tabB.instance.repository.subtle.cacheEntries().filter((entry) => entry.isUnused).length).toBe(1);

    a.run(() => createPlayer()).execute({ args: { body: { name: 'Alice' } } });
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(s.api.requestCount('GET', '/players')).toBe(2);
    expect(s.api.requestCount('GET', '/teams')).toBe(1);

    a.destroy();
    watched.destroy();

    s.tick(60_000);
    s.tick(1);

    tabA.destroy();
    tabB.destroy();
  });

  it('derives the channel name from the client name, so two default-configured clients never cross-talk', async () => {
    const s = scenario();
    let version = 0;
    s.api.on('GET', '/default-channel', () => ({ body: { v: ++version } }));

    const tabA = createTab(s, { sync: {} });
    const tabB = createTab(s, { sync: {} });
    const getA = tabA.get<{ response: { v: number } }>('/default-channel');
    const getB = tabB.get<{ response: { v: number } }>('/default-channel');

    const a = tabA.consumer();
    const b = tabB.consumer();
    const queryA = a.run(() => getA());
    const queryB = b.run(() => getB());

    await s.settle();
    await flushMultiTabSync();

    const responseBAfterMount = queryB.response();
    const postedBefore = bus.posted.length;

    queryA.execute();
    await s.settle();
    await flushMultiTabSync();
    await s.settle();

    expect(bus.posted.slice(postedBefore).map((message) => message.channel)).toEqual([`et-query-sync-${tabA.name}`]);
    expect(queryA.response()).not.toEqual(responseBAfterMount);
    expect(queryB.response()).toEqual(responseBAfterMount);

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('lets every tab poll a query that opted out with multiTabSync: false', async () => {
    const s = scenario();
    let n = 0;
    s.api.on('GET', '/exports/full', () => ({ body: { n: ++n } }));

    const tabA = createTab(s);
    const tabB = createTab(s);
    const getA = tabA.get<{ response: { n: number } }>('/exports/full', { multiTabSync: false });
    const getB = tabB.get<{ response: { n: number } }>('/exports/full', { multiTabSync: false });

    const a = tabA.consumer();
    const b = tabB.consumer();
    a.run(() => getA(withPolling({ interval: 10_000 })));
    b.run(() => getB(withPolling({ interval: 10_000 })));

    await s.settle();
    await flushMultiTabSync();

    const requestsAfterMount = s.api.requestCount('GET', '/exports/full');

    await pollTick(s, 10_000);

    expect(s.api.requestCount('GET', '/exports/full')).toBe(requestsAfterMount + 2);
    expect(locks.heldNames()).toEqual([]);
    expect(locks.pendingNames()).toEqual([]);

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });

  it('opens no channel and requests no lock on the server', async () => {
    const s = scenario();
    s.api.on('GET', '/ssr', () => ({ body: { ok: true } }));

    const tab = createTab(s, { providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const getSsr = tab.get<{ response: { ok: boolean } }>('/ssr');

    const postedBefore = bus.posted.length;

    const c = tab.consumer();
    const query = c.run(() => getSsr(withPolling({ interval: 10_000 })));

    await s.settle();
    await flushMultiTabSync();

    expect(query.response()).toEqual({ ok: true });
    expect(tab.instance.subtle.sync).toBeNull();
    expect(bus.posted.length).toBe(postedBefore);
    expect(locks.heldNames()).toEqual([]);
    expect(locks.pendingNames()).toEqual([]);

    c.destroy();
    tab.destroy();
  });
});

describe('multi-tab sync without the browser APIs', () => {
  let originalBroadcastChannel: unknown;
  let locksDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalBroadcastChannel = (globalThis as Record<string, unknown>)['BroadcastChannel'];
    locksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');

    delete (globalThis as Record<string, unknown>)['BroadcastChannel'];
    delete (navigator as unknown as Record<string, unknown>)['locks'];
  });

  afterEach(() => {
    if (originalBroadcastChannel === undefined) {
      delete (globalThis as Record<string, unknown>)['BroadcastChannel'];
    } else {
      (globalThis as Record<string, unknown>)['BroadcastChannel'] = originalBroadcastChannel;
    }

    if (locksDescriptor) Object.defineProperty(navigator, 'locks', locksDescriptor);
  });

  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  it('degrades to every tab fetching and polling for itself', async () => {
    const s = scenario();
    let n = 0;
    s.api.on('GET', '/degraded', () => ({ body: { n: ++n } }));

    const tabA = createTab(s);
    const tabB = createTab(s);
    const getA = tabA.get<{ response: { n: number } }>('/degraded');
    const getB = tabB.get<{ response: { n: number } }>('/degraded');

    const a = tabA.consumer();
    const b = tabB.consumer();
    a.run(() => getA(withPolling({ interval: 10_000 })));
    b.run(() => getB(withPolling({ interval: 10_000 })));

    await s.settle();

    expect(s.api.requestCount('GET', '/degraded')).toBe(2);

    await pollTick(s, 10_000);

    expect(s.api.requestCount('GET', '/degraded')).toBe(4);
    expect(s.errors).toEqual([]);

    a.destroy();
    b.destroy();
    tabA.destroy();
    tabB.destroy();
  });
});
