import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  PLATFORM_ID,
  runInInjectionContext,
  signal,
  Signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuery, Query, QueryArgs } from '../query';
import { createQueryClient, QueryClientRef } from '../query-client';
import { QueryMethod } from '../query-creator';
import { withArgs, withPolling } from '../query-features';
import { QueryMultiTabSyncConfig } from './query-sync-config';

/** One channel name for every client in a spec, so two clients behave as two tabs of one app. */
const CHANNEL = 'spec-channel';

type PolledTab = { query: Query<QueryArgs>; destroy: () => void };

describe('multi tab sync', () => {
  let bus: FakeBroadcastChannelHandle;
  let locks: FakeWebLocksHandle;
  let httpTesting: HttpTestingController;
  let parent: EnvironmentInjector;
  let held: TestRequest[] = [];
  let tabCount = 0;

  beforeEach(() => {
    bus = installFakeBroadcastChannel();
    locks = installFakeWebLocks();
    held = [];

    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });

    httpTesting = TestBed.inject(HttpTestingController);
    parent = TestBed.inject(EnvironmentInjector);
  });

  afterEach(() => {
    bus.restore();
    locks.restore();
  });

  /**
   * A tab is just another query client on the shared channel: separate repository, separate engine,
   * same bus and same lock table — which is exactly the relationship two browser tabs are in.
   */
  const createTab = (multiTabSync: boolean | QueryMultiTabSyncConfig = { channelName: CHANNEL }) =>
    createQueryClient({ baseUrl: 'https://api.example.com', name: `tab-${++tabCount}`, multiTabSync });

  const mountQuery = (
    client: QueryClientRef,
    options: { method?: QueryMethod; route?: `/${string}`; multiTabSync?: boolean; useCache?: boolean } = {},
  ) => {
    const injector = createEnvironmentInjector([], parent);

    const query = runInInjectionContext(injector, () =>
      createQuery({
        creator: {
          multiTabSync: options.multiTabSync,
          subtle: { useQueryRepositoryCache: options.useCache },
        },
        creatorInternals: { client, method: options.method ?? 'GET', route: options.route ?? '/players' },
        features: [],
        queryConfig: {},
      }),
    );

    return { query, destroy: () => injector.destroy() };
  };

  /**
   * The tabs share one testing controller, and `match()` *removes* everything it matches — so
   * requests are drained into a local queue instead, letting a spec settle one tab's request while
   * the other's is still in flight.
   */
  const pending = () => {
    held.push(...httpTesting.match(() => true).filter((req) => !req.cancelled));

    return held;
  };

  /** Settles the oldest request in flight, then lets the sync messages it produced land. */
  const flushNext = async (body: unknown, headers?: Record<string, string>) => {
    const req = pending().shift();

    if (!req) throw new Error('Expected a request to be in flight.');

    req.flush(body, headers ? { headers } : undefined);
    TestBed.tick();

    await flushMultiTabSync();
  };

  const flushAll = async (body: unknown) => {
    for (const req of pending().splice(0)) {
      req.flush(body);
    }

    TestBed.tick();

    await flushMultiTabSync();
  };

  const expectNothingInFlight = () => expect(pending().map((req) => req.request.urlWithParams)).toEqual([]);

  describe('response sharing', () => {
    it('updates the same query in another tab without a second request', async () => {
      const tabA = mountQuery(createTab());
      const tabB = mountQuery(createTab());

      await flushAll({ version: 1 });

      expect(tabB.query.response()).toEqual({ version: 1 });

      // Tab A refetches — a poll tick, or the user hitting refresh there.
      tabA.query.execute();
      await flushNext({ version: 2 });

      expect(tabA.query.response()).toEqual({ version: 2 });
      expect(tabB.query.response()).toEqual({ version: 2 });
      expect(tabB.query.executionState()).toMatchObject({ type: 'success' });

      // The whole point: tab B is up to date and never went to the network for it.
      expectNothingInFlight();
    });

    it('shares freshness, so the receiving tab can serve the entry from cache', async () => {
      const tabA = mountQuery(createTab());
      const tabB = mountQuery(createTab());

      await flushAll({ version: 1 });

      tabA.query.execute();
      await flushNext({ version: 2 }, { 'cache-control': 'max-age=600' });

      tabB.query.execute({ options: { allowCache: true } });

      expect(tabB.query.response()).toEqual({ version: 2 });
      expectNothingInFlight();
    });

    it('does not bounce an applied response back to the other tabs', async () => {
      const tabA = mountQuery(createTab());
      mountQuery(createTab());

      await flushAll({ version: 1 });

      const postedAfterInitialFetches = bus.posted.length;

      tabA.query.execute();
      await flushNext({ version: 2 });
      // Exactly one message: tab A's response. If applying it re-emitted a request event, tab B would
      // have broadcast it straight back and the two would ping-pong forever.
      expect(bus.posted.length).toBe(postedAfterInitialFetches + 1);
    });

    it('skips a tab that has a request of its own in flight', async () => {
      const tabA = mountQuery(createTab());
      const tabB = mountQuery(createTab());

      // Both tabs mounted and are still loading, so tab A's response arrives at a tab that has a
      // fetch of its own outstanding. Applying it there would be pointless churn — the local request
      // is at least as fresh and about to overwrite it anyway.
      await flushNext({ version: 1 });

      expect(tabB.query.response()).toBeNull();

      await flushNext({ version: 2 });

      expect(tabB.query.response()).toEqual({ version: 2 });

      // And tab A, no longer loading, takes tab B's newer response.
      expect(tabA.query.response()).toEqual({ version: 2 });
    });

    it('ignores a key the receiving tab never held', async () => {
      const tabA = mountQuery(createTab());
      const tabB = createTab();

      await flushAll({ version: 1 });

      expect(tabA.query.response()).toEqual({ version: 1 });
      expect(TestBed.inject(tabB[2]).repository.subtle.cacheEntries()).toEqual([]);
    });

    it('updates an entry that is only being retained', async () => {
      const tabA = mountQuery(createTab());
      const tabB = mountQuery(createTab());

      await flushAll({ version: 1 });

      const retainedRequest = tabB.query.subtle.request();

      // The user navigated away in tab B. Its entry survives its `keepUnusedFor` window.
      tabB.destroy();

      tabA.query.execute();
      await flushNext({ version: 2 });

      expect(retainedRequest?.response()).toEqual({ version: 2 });
    });

    it('stays quiet for a query that opted out', async () => {
      const tabA = mountQuery(createTab(), { multiTabSync: false });
      const tabB = mountQuery(createTab(), { multiTabSync: false });

      await flushAll({ version: 1 });

      tabA.query.execute();
      await flushNext({ version: 2 });

      expect(tabB.query.response()).toEqual({ version: 1 });
      expect(bus.posted).toEqual([]);
    });

    it('stays quiet when syncResponses is off', async () => {
      const tabA = mountQuery(createTab({ channelName: CHANNEL, syncResponses: false }));
      const tabB = mountQuery(createTab({ channelName: CHANNEL, syncResponses: false }));

      await flushAll({ version: 1 });

      tabA.query.execute();
      await flushNext({ version: 2 });

      expect(tabB.query.response()).toEqual({ version: 1 });
    });

    it('does nothing at all when multiTabSync is off', async () => {
      const tabA = mountQuery(createTab(false));
      const tabB = mountQuery(createTab(false));

      await flushAll({ version: 1 });

      tabA.query.execute();
      await flushNext({ version: 2 });

      expect(tabB.query.response()).toEqual({ version: 1 });
      expect(bus.posted).toEqual([]);
    });

    it('is on for a client that says nothing about it', () => {
      const client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'defaults' });

      expect(TestBed.inject(client[2]).subtle.sync).not.toBeNull();
      expect(bus.posted).toEqual([]);
    });
  });

  describe('mutation driven refresh', () => {
    it('refreshes the other tab and leaves the mutating one alone', async () => {
      const tabAClient = createTab();
      const tabA = mountQuery(tabAClient);
      const tabB = mountQuery(createTab());

      await flushAll({ version: 1 });

      const mutation = mountQuery(tabAClient, { method: 'POST', route: '/players' });

      mutation.query.execute();
      await flushNext({ created: true });

      expect(tabB.query.loading()).not.toBeNull();
      expect(tabA.query.loading()).toBeNull();

      await flushNext({ version: 2 });

      expect(tabB.query.response()).toEqual({ version: 2 });
    });

    it('only refreshes the queries a filter accepts', async () => {
      const filter = { filter: (_mutation: { url: string }, query: { url: string }) => query.url.includes('/players') };

      const tabAClient = createTab({ channelName: CHANNEL, refreshOnMutation: filter });
      const tabBClient = createTab({ channelName: CHANNEL, refreshOnMutation: filter });

      const players = mountQuery(tabBClient, { route: '/players' });
      const teams = mountQuery(tabBClient, { route: '/teams' });

      await flushAll({ version: 1 });

      const mutation = mountQuery(tabAClient, { method: 'POST', route: '/players' });

      mutation.query.execute();
      await flushNext({ created: true });

      expect(players.query.loading()).not.toBeNull();
      expect(teams.query.loading()).toBeNull();

      await flushNext({ version: 2 });
    });

    it('stays quiet when refreshOnMutation is off', async () => {
      const tabAClient = createTab({ channelName: CHANNEL, refreshOnMutation: false });
      const tabB = mountQuery(createTab({ channelName: CHANNEL, refreshOnMutation: false }));

      await flushAll({ version: 1 });

      const mutation = mountQuery(tabAClient, { method: 'POST', route: '/players' });

      mutation.query.execute();
      await flushNext({ created: true });

      expect(tabB.query.loading()).toBeNull();
      expectNothingInFlight();
    });

    it('does not treat an uncacheable read as a mutation', async () => {
      const tabAClient = createTab();
      const tabB = mountQuery(createTab());

      await flushAll({ version: 1 });

      // A read that opted out of the repository cache has a per-request key no other tab can derive,
      // so there is nothing to share — but it must not be mistaken for a mutation either.
      const uncached = mountQuery(tabAClient, { route: '/scores', useCache: false });

      uncached.query.execute();
      await flushNext({ scores: [] });

      expect(tabB.query.loading()).toBeNull();
      expect(bus.posted.filter((message) => (message.data as { url?: string }).url !== undefined)).toEqual([]);
    });
  });

  describe('polling dedup', () => {
    const INTERVAL = 10_000;

    beforeEach(() => {
      // `queueMicrotask` is deliberately left real: the fakes deliver messages and grant locks on it,
      // and faking it would mean pumping the timer API to move a lock between tabs.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    });

    afterEach(() => {
      vi.useRealTimers();
      setHidden(false);
    });

    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    const mountPollingQuery = (
      client: QueryClientRef,
      options: { multiTabSync?: boolean; page?: Signal<number> } = {},
    ) => {
      const injector = createEnvironmentInjector([], parent);
      const { page } = options;

      const query = runInInjectionContext(injector, () =>
        createQuery({
          creator: { multiTabSync: options.multiTabSync },
          creatorInternals: { client, method: 'GET', route: '/players' },
          features: page
            ? [
                withArgs<QueryArgs>(() => ({ queryParams: { page: page() } })),
                withPolling<QueryArgs>({ interval: INTERVAL }),
              ]
            : [withPolling<QueryArgs>({ interval: INTERVAL })],
          queryConfig: page ? {} : { silenceMissingWithArgsFeatureError: true },
        }),
      );

      return { query, destroy: () => injector.destroy() };
    };

    /** Runs one interval and reports how many requests it produced across both tabs. */
    const tick = async () => {
      vi.advanceTimersByTime(INTERVAL);
      TestBed.tick();

      const count = pending().length;

      await flushAll({ version: 2 });

      return count;
    };

    /** Runs one interval and reports which tab did the polling, by its query's loading state. */
    const tickAndFindPoller = async (tabs: { tabA: PolledTab; tabB: PolledTab }) => {
      vi.advanceTimersByTime(INTERVAL);
      TestBed.tick();

      const polled = [...(tabs.tabA.query.loading() ? ['a'] : []), ...(tabs.tabB.query.loading() ? ['b'] : [])];

      await flushAll({ version: 2 });

      return polled;
    };

    /** Mounts both tabs, settles their initial fetches and lets the lock be granted. */
    const settleTwoTabs = async (multiTabSync?: boolean | QueryMultiTabSyncConfig, creatorSync?: boolean) => {
      const tabA = mountPollingQuery(createTab(multiTabSync), { multiTabSync: creatorSync });
      const tabB = mountPollingQuery(createTab(multiTabSync), { multiTabSync: creatorSync });

      TestBed.tick();
      await flushAll({ version: 1 });
      await flushMultiTabSync();

      return { tabA, tabB };
    };

    it('polls in one tab only', async () => {
      const tabs = await settleTwoTabs();

      // FIFO: the tab that asked first got the lock.
      expect(locks.heldNames()).toHaveLength(1);
      expect(await tickAndFindPoller(tabs)).toEqual(['a']);
      expect(await tickAndFindPoller(tabs)).toEqual(['a']);
      expect(tabs.tabB.query.response()).toEqual({ version: 2 });
    });

    it('hands polling over when the holding tab goes away', async () => {
      const tabs = await settleTwoTabs();

      expect(await tickAndFindPoller(tabs)).toEqual(['a']);

      // The holder navigates away — its query, and with it the lock, is gone.
      tabs.tabA.destroy();
      await flushMultiTabSync();
      await flushMultiTabSync();

      // The standby tab took over within one interval, so the data keeps flowing.
      expect(await tickAndFindPoller(tabs)).toEqual(['b']);
      expect(locks.heldNames()).toHaveLength(1);
    });

    it('re-keys the lock when the args change', async () => {
      const page = signal(1);
      const tabA = mountPollingQuery(createTab(), { page });

      TestBed.tick();
      await flushAll({ version: 1 });
      await flushMultiTabSync();

      const [firstLock] = locks.heldNames();

      page.set(2);
      TestBed.tick();
      await flushAll({ version: 1 });
      await flushMultiTabSync();

      const [secondLock] = locks.heldNames();

      expect(locks.heldNames()).toHaveLength(1);
      expect(secondLock).not.toBe(firstLock);
      expect(tabA.query.response()).toEqual({ version: 1 });
    });

    it('hands polling to a visible tab when the holder is hidden', async () => {
      const tabs = await settleTwoTabs();

      expect(await tickAndFindPoller(tabs)).toEqual(['a']);

      // Both tabs share one document here, so both see the event — and only the holder reacts, which
      // is the guard that makes the handover go one way instead of shuffling every tab's place in the
      // queue.
      setHidden(true);
      await flushMultiTabSync();
      await flushMultiTabSync();

      // Still one poll per interval, now from the tab that was waiting behind the hidden one.
      expect(await tickAndFindPoller(tabs)).toEqual(['b']);

      tabs.tabA.destroy();
    });

    it('lets every tab poll without Web Locks', async () => {
      locks.restore();

      await settleTwoTabs();

      expect(await tick()).toBe(2);
    });

    it('lets every tab poll when dedupePolling is off', async () => {
      await settleTwoTabs({ channelName: CHANNEL, dedupePolling: false });

      expect(await tick()).toBe(2);
    });

    it('lets every tab poll when response sharing is off', async () => {
      await settleTwoTabs({ channelName: CHANNEL, syncResponses: false });

      expect(await tick()).toBe(2);
    });

    it('lets every tab poll a query that opted out', async () => {
      await settleTwoTabs({ channelName: CHANNEL }, false);

      expect(await tick()).toBe(2);
    });

    it('lets every tab poll when multiTabSync is off', async () => {
      await settleTwoTabs(false);

      expect(await tick()).toBe(2);
    });
  });

  describe('SSR', () => {
    it('creates no engine, channel or lock', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PLATFORM_ID, useValue: 'server' }],
      });

      const client = createQueryClient({
        baseUrl: 'https://api.example.com',
        name: 'ssr',
        multiTabSync: true,
      });

      expect(TestBed.inject(client[2]).subtle.sync).toBeNull();
      expect(bus.posted).toEqual([]);
      expect(locks.heldNames()).toEqual([]);
    });
  });
});
