import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { createEnvironmentInjector, DestroyRef, EnvironmentInjector, inject, PLATFORM_ID, signal } from '@angular/core';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import {
  createGetQuery,
  createQueryClient,
  createSecureGetQuery,
  MAX_UNUSED_ENTRIES,
  QueryClientRef,
  QueryInvalidationCandidate,
  QueryRepositoryEvent,
  withArgs,
  withMultiTabSync,
  withResponseUpdate,
} from '../index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sequence } from './harness/fake-api';
import { Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const FILTER_CHANNEL = 'caching-scenario-filter';

let secondTabCounter = 0;

type SecondTab = {
  get: ReturnType<typeof createGetQuery>;
  consumer: () => { run: <T>(fn: () => T) => T; destroy: () => void };
  destroy: () => void;
};

/**
 * A second query client on the same channel, standing in for another browser tab. Its consumers live
 * below the tab's own injector, not below the TestBed root: the client token is `providedIn: 'root'`,
 * so a query created anywhere else would resolve a second, root-owned instance of the same client.
 */
const createSecondTab = (s: Scenario): SecondTab => {
  const ref: QueryClientRef = createQueryClient({
    name: `caching-scenario-tab-${++secondTabCounter}`,
    baseUrl: BASE_URL,
    keepUnusedFor: 0,
    features: [withMultiTabSync({ channelName: FILTER_CHANNEL })],
  });

  const injector = createEnvironmentInjector(
    ref.provide(),
    s.run(() => inject(EnvironmentInjector)),
  );

  if (!injector.runInContext(() => ref.inject())) {
    throw new Error('caching scenario: failed to create the second tab client');
  }

  const consumers = new Set<EnvironmentInjector>();

  return {
    get: createGetQuery(ref),
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

describe('caching scenario', () => {
  describe('deduplication', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('shares one request for identical args across consumers, and fires a second one for different args', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

      const a = s.consumer();
      const b = s.consumer();
      const c = s.consumer();
      const q1 = a.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));
      const q2 = b.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));
      const q3 = c.run(() => getUser(withArgs(() => ({ pathParams: { id: '2' } }))));

      s.tick();

      expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      expect(s.api.requestCount('GET', '/users/2')).toBe(1);
      expect(q1.response()).toEqual(q2.response());
      expect(q3.response()).toEqual({ id: '2' });

      a.destroy();
      b.destroy();
      c.destroy();
    });

    it('excludes authorization from cache keys while keeping other per-execution headers', () => {
      const s = scenario();
      s.api.on('GET', '/header-key', ({ headers }) => ({
        body: { authorization: headers.get('Authorization'), tenant: headers.get('X-Tenant') },
      }));

      const getHeaderKey = s.get<{
        response: { authorization: string | null; tenant: string | null };
        headers: HttpHeaders;
      }>('/header-key');
      const a = s.consumer();
      const b = s.consumer();
      const c = s.consumer();
      const queryA = a.run(() =>
        getHeaderKey(withArgs(() => ({ headers: new HttpHeaders({ Authorization: 'Bearer a', 'X-Tenant': 'one' }) }))),
      );
      const queryB = b.run(() =>
        getHeaderKey(withArgs(() => ({ headers: new HttpHeaders({ Authorization: 'Bearer b', 'X-Tenant': 'one' }) }))),
      );
      const queryC = c.run(() =>
        getHeaderKey(withArgs(() => ({ headers: new HttpHeaders({ Authorization: 'Bearer a', 'X-Tenant': 'two' }) }))),
      );

      s.tick();

      expect(s.api.requestCount('GET', '/header-key')).toBe(2);
      expect(queryA.id()).toBe(queryB.id());
      expect(queryC.id()).not.toBe(queryA.id());
      expect(queryA.response()).toEqual(queryB.response());
      expect(queryC.response()?.tenant).toBe('two');

      a.destroy();
      b.destroy();
      c.destroy();
    });
  });

  describe('freshness (cache-adapter TTL)', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('serves an allowCache execute from the cache within the TTL, and re-fetches once it expires', () => {
      const s = scenario();
      s.api.on(
        'GET',
        '/lifecycle',
        sequence([
          { body: { n: 1 }, headers: { 'cache-control': 'max-age=20' } },
          { body: { n: 2 }, headers: { 'cache-control': 'max-age=20' } },
        ]),
      );

      const getLifecycle = s.get<{ response: { n: number } }>('/lifecycle');

      const c = s.consumer();
      const query = c.run(() => getLifecycle());

      s.tick();
      expect(query.response()).toEqual({ n: 1 });
      expect(s.api.requestCount('GET', '/lifecycle')).toBe(1);

      // max-age=20 halves to a 10s freshness window - well inside it, allowCache must not hit the server.
      s.tick(9_000);
      query.execute({ options: { allowCache: true } });
      s.tick();
      expect(s.api.requestCount('GET', '/lifecycle')).toBe(1);
      expect(query.response()).toEqual({ n: 1 });

      s.tick(1_001);
      query.execute({ options: { allowCache: true } });
      s.tick();
      expect(s.api.requestCount('GET', '/lifecycle')).toBe(2);
      expect(query.response()).toEqual({ n: 2 });

      c.destroy();
    });
  });

  describe('keepUnusedFor retention', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 5_000 } });

    it('keeps an unused entry around and renders its response immediately to a consumer that rebinds within the window', () => {
      const s = scenario();
      s.api.on('GET', '/report', () => ({ body: { rows: [1, 2, 3] } }));

      const getReport = s.get<{ response: { rows: number[] } }>('/report');

      const a = s.consumer();
      a.run(() => getReport());
      s.tick();
      expect(s.api.requestCount('GET', '/report')).toBe(1);

      a.destroy();
      expect(s.client.repository.subtle.cacheEntries()).toEqual([
        expect.objectContaining({ isUnused: true, consumerCount: 0 }),
      ]);

      s.tick(4_000);

      const b = s.consumer();
      const query = b.run(() => getReport());

      // Available synchronously, before any tick - the point of retention.
      expect(query.response()).toEqual({ rows: [1, 2, 3] });

      // Documented as "revalidating in the background" - rebinding does fire a fresh request.
      s.tick();
      expect(s.api.requestCount('GET', '/report')).toBe(2);

      b.destroy();
      s.tick(5_001);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
    });

    it('cancels the pending eviction timer when a consumer rebinds, and starts a fresh window on the next unbind', () => {
      const s = scenario();
      s.api.on('GET', '/cancel-evict', sequence([{ body: { n: 1 } }, { body: { n: 2 } }]));

      const getEntry = s.get<{ response: { n: number } }>('/cancel-evict');

      const a = s.consumer();
      a.run(() => getEntry());
      s.tick();
      a.destroy();

      s.tick(2_000);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(1);

      const b = s.consumer();
      const query = b.run(() => getEntry());
      s.tick();
      expect(query.response()).toEqual({ n: 2 });

      b.destroy();

      // If the first window's timer had not been cancelled it would fire here (2_000 + 3_000 = 5_000ms
      // after the first unbind); the second unbind started its own 5_000ms window instead.
      s.tick(3_000);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(1);

      s.tick(2_000);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
    });

    it('ignores a second unbind of the same consumer instead of destroying the live entry or leaking a timer', () => {
      const s = scenario();
      s.api.on('GET', '/solo', () => ({ body: { ok: true } }));

      const getSolo = s.get<{ response: { ok: boolean } }>('/solo');

      const c = s.consumer();
      const query = c.run(() => getSolo());
      s.tick();

      query.execute();
      query.execute();
      s.tick();

      const key = query.id();
      if (!key) throw new Error('expected a repository key');

      expect(s.client.repository.subtle.cacheEntries()).toEqual([expect.objectContaining({ key, consumerCount: 1 })]);

      const consumerDestroyRef = query.subtle.injector.get(DestroyRef);

      expect(s.client.repository.unbind(key, consumerDestroyRef)).toBe(true);
      expect(s.client.repository.subtle.cacheEntries()).toEqual([expect.objectContaining({ key, isUnused: true })]);

      expect(s.client.repository.unbind(key, consumerDestroyRef)).toBe(false);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(1);

      c.destroy();

      s.tick(4_999);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(1);

      s.tick(1);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
    });

    it('restores the longer keepUnusedFor when the short-retention consumer unbinds', () => {
      const s = scenario();
      s.api.on('GET', '/retention-merge', () => ({ body: { n: 1 } }));

      const getEntry = s.get<{ response: { n: number } }>('/retention-merge');

      const a = s.consumer();
      a.run(() => getEntry());
      s.tick();

      const b = s.consumer();
      const polling = b.run(() => getEntry());
      polling.execute({ options: { keepUnusedFor: 0 } });
      s.tick();

      b.destroy();
      a.destroy();

      // The consumer that asked for no retention is gone, so the entry falls back to the 5_000ms
      // window the remaining consumer created it with.
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(1);

      s.tick(4_999);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(1);

      s.tick(2);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
    });
  });

  describe('merged policies across consumers', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('keeps a shared entry secure after the secure consumer unbinds, so the logout still takes it', async () => {
      const s = scenario();
      const auth = s.auth();
      s.api.on('GET', '/shared-entry', () => ({ body: { id: 'me' } }));

      const getShared = s.get<{ response: { id: string } }>('/shared-entry');
      const getSharedSecure = createSecureGetQuery(
        s.clientRef,
        auth.ref,
      )<{ response: { id: string } }>('/shared-entry');

      const publicConsumer = s.consumer();
      publicConsumer.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();

      const publicQuery = publicConsumer.run(() => getShared());
      const secureConsumer = s.consumer();
      const secureQuery = secureConsumer.run(() => getSharedSecure());
      await s.settle();

      const key = publicQuery.id();
      expect(key).toBe(secureQuery.id());
      expect(publicQuery.response()).toEqual({ id: 'me' });

      secureConsumer.destroy();

      s.run(() => auth.logout());
      await s.settle();

      // The body was fetched with a bearer token, so the entry stays secure even though only the
      // public consumer is left, and the logout takes it.
      expect(s.client.repository.subtle.cacheEntries().map((entry) => entry.key)).not.toContain(key);

      publicConsumer.destroy();
    });
  });

  describe('unused entry cap', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 600_000 } });

    it('evicts the least recently orphaned unused entry once the cap is exceeded', () => {
      const s = scenario();
      s.api.on('GET', '/items/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getItem = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/items/${p.id}`);

      const keys: string[] = [];

      for (let i = 0; i < MAX_UNUSED_ENTRIES + 1; i++) {
        const c = s.consumer();
        const query = c.run(() => getItem(withArgs(() => ({ pathParams: { id: String(i) } }))));
        s.tick();

        const key = query.id();
        if (!key) throw new Error('expected a repository key');
        keys.push(key);

        c.destroy();
      }

      const cacheKeys = new Set(s.client.repository.subtle.cacheEntries().map((e) => e.key));
      expect(cacheKeys.size).toBe(MAX_UNUSED_ENTRIES);
      expect(cacheKeys.has(keys[0] as string)).toBe(false);
      expect(cacheKeys.has(keys[keys.length - 1] as string)).toBe(true);

      s.tick(600_001);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
    });
  });

  describe('refreshing and invalidating in-use entries', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 5_000 } });

    it('invalidateQueries refreshes only in-use entries matching the url filter', () => {
      const s = scenario();
      s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'] } }));
      s.api.on('GET', '/teams/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getPlayer = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);
      const getTeam = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/teams/${p.id}`);

      const a = s.consumer();
      a.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));

      const b = s.consumer();
      b.run(() => getTeam(withArgs(() => ({ pathParams: { id: '9' } }))));

      const orphan = s.consumer();
      orphan.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '2' } }))));

      s.tick();
      orphan.destroy();

      expect(s.api.requestCount('GET', '/players/1')).toBe(1);
      expect(s.api.requestCount('GET', '/players/2')).toBe(1);
      expect(s.api.requestCount('GET', '/teams/9')).toBe(1);

      s.client.invalidateQueries({ url: '/players' });
      s.tick();

      expect(s.api.requestCount('GET', '/players/1')).toBe(2);
      expect(s.api.requestCount('GET', '/players/2')).toBe(1);
      expect(s.api.requestCount('GET', '/teams/9')).toBe(1);

      a.destroy();
      b.destroy();
      s.tick(5_001);
    });

    it('refreshQueriesInUse re-requests every bound entry but leaves unbound ones alone', () => {
      const s = scenario();
      s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'] } }));
      s.api.on('GET', '/teams/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getPlayer = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);
      const getTeam = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/teams/${p.id}`);

      const a = s.consumer();
      a.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));

      const b = s.consumer();
      b.run(() => getTeam(withArgs(() => ({ pathParams: { id: '9' } }))));

      const orphan = s.consumer();
      orphan.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '2' } }))));

      s.tick();
      orphan.destroy();

      s.client.refreshQueriesInUse();
      s.tick();

      expect(s.api.requestCount('GET', '/players/1')).toBe(2);
      expect(s.api.requestCount('GET', '/teams/9')).toBe(2);
      expect(s.api.requestCount('GET', '/players/2')).toBe(1);

      a.destroy();
      b.destroy();
      s.tick(5_001);
    });

    it.each([
      { name: 'refreshQueriesInUse', refresh: (s: ReturnType<typeof scenario>) => s.client.refreshQueriesInUse() },
      {
        name: 'invalidateQueries',
        refresh: (s: ReturnType<typeof scenario>) => s.client.invalidateQueries({ url: '/restart' }),
      },
    ])('$name aborts and replaces an in-flight read', ({ refresh }) => {
      const s = scenario();
      s.api.on('GET', '/restart', sequence([{ body: { version: 1 }, delay: 500 }, { body: { version: 2 } }]));

      const getRestart = s.get<{ response: { version: number } }>('/restart');
      const c = s.consumer();
      const query = c.run(() => getRestart());

      expect(s.api.pending()).toHaveLength(1);
      refresh(s);
      s.tick();

      expect(s.api.requestCount('GET', '/restart')).toBe(2);
      expect(s.api.requests[0]?.aborted).toBe(true);
      expect(query.response()).toEqual({ version: 2 });

      c.destroy();
      s.tick(5_001);
    });
  });

  describe('updating response() without a request', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('withResponseUpdate writes a reactive value onto response() without executing the query', () => {
      const s = scenario();
      s.api.on('GET', '/live', () => ({ body: { score: 0 } }));

      const getLive = s.get<{ response: { score: number } }>('/live');
      const external = signal<{ score: number } | null>(null);

      const c = s.consumer();
      const query = c.run(() => getLive(withResponseUpdate({ updater: () => external() })));

      s.tick();
      expect(query.response()).toEqual({ score: 0 });
      expect(s.api.requestCount('GET', '/live')).toBe(1);

      external.set({ score: 99 });
      s.tick();

      expect(query.response()).toEqual({ score: 99 });
      expect(s.api.requestCount('GET', '/live')).toBe(1);

      c.destroy();
    });

    it('applyExternalResponse writes onto a matching entry without a request, and is skipped while one is in flight', () => {
      const s = scenario();
      s.api.on('GET', '/shared', sequence([{ body: { v: 1 } }, { body: { v: 2 }, delay: 500 }]));

      const getShared = s.get<{ response: { v: number } }>('/shared');

      const c = s.consumer();
      const query = c.run(() => getShared());
      s.tick();

      const key = query.id();
      if (!key) throw new Error('expected a repository key');

      expect(s.client.repository.applyExternalResponse({ key, body: { v: 99 }, expiresAt: null })).toBe(true);
      s.tick();
      expect(query.response()).toEqual({ v: 99 });
      expect(s.api.requestCount('GET', '/shared')).toBe(1);

      query.execute();
      expect(s.client.repository.applyExternalResponse({ key, body: { v: 123 }, expiresAt: null })).toBe(false);

      s.tick(500);
      expect(query.response()).toEqual({ v: 2 });

      c.destroy();
    });
  });
  describe('server platform', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 60_000 },
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    it('releases an entry as soon as its last consumer unbinds, without arming an eviction timer', () => {
      const s = scenario();
      s.api.on('GET', '/ssr-report', () => ({ body: { rows: [1, 2] } }));

      const getReport = s.get<{ response: { rows: number[] } }>('/ssr-report');

      const c = s.consumer();
      const query = c.run(() => getReport());
      s.tick();
      expect(query.response()).toEqual({ rows: [1, 2] });

      c.destroy();

      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);

      s.tick(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('aborts a request that is still in flight when its consumer unbinds', () => {
      const s = scenario();
      s.api.on('GET', '/ssr-slow', () => ({ body: { ok: true }, delay: 500 }));

      const getSlow = s.get<{ response: { ok: boolean } }>('/ssr-slow');

      const c = s.consumer();
      c.run(() => getSlow());

      expect(s.api.pending()).toHaveLength(1);

      c.destroy();

      expect(s.api.requests[0]?.aborted).toBe(true);
      expect(s.api.pending()).toHaveLength(0);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
    });

    it('re-requests on a rebind because nothing was retained to render', () => {
      const s = scenario();
      s.api.on('GET', '/ssr-data', sequence([{ body: { n: 1 } }, { body: { n: 2 } }]));

      const getData = s.get<{ response: { n: number } }>('/ssr-data');

      const a = s.consumer();
      const qa = a.run(() => getData());
      s.tick();
      expect(qa.response()).toEqual({ n: 1 });

      a.destroy();

      const b = s.consumer();
      const qb = b.run(() => getData());

      expect(qb.response()).toBeNull();

      s.tick();
      expect(s.api.requestCount('GET', '/ssr-data')).toBe(2);
      expect(qb.response()).toEqual({ n: 2 });

      b.destroy();
    });
  });

  describe('browser platform contrast', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 60_000 } });

    it('keeps the entry for the retention window instead of releasing it at once', () => {
      const s = scenario();
      s.api.on('GET', '/ssr-report', () => ({ body: { rows: [1, 2] } }));

      const getReport = s.get<{ response: { rows: number[] } }>('/ssr-report');

      const c = s.consumer();
      c.run(() => getReport());
      s.tick();

      c.destroy();

      expect(s.client.repository.subtle.cacheEntries()).toEqual([
        expect.objectContaining({ isUnused: true, consumerCount: 0 }),
      ]);

      s.tick(60_001);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
    });
  });

  describe('what is cached', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('caches an OPTIONS and a HEAD request the way it caches a GET', () => {
      const s = scenario();
      s.api.on('HEAD', '/probe-head', () => ({ body: { ok: true } }));
      s.api.on('OPTIONS', '/probe-options', () => ({ body: { allow: 'GET' } }));

      const headProbe = s.head<{ response: { ok: boolean } }>('/probe-head');
      const optionsProbe = s.options<{ response: { allow: string } }>('/probe-options');

      const a = s.consumer();
      const b = s.consumer();
      const headA = a.run(() => headProbe());
      const headB = b.run(() => headProbe());
      const optionsA = a.run(() => optionsProbe());
      const optionsB = b.run(() => optionsProbe());

      s.tick();

      expect(s.api.requestCount('HEAD', '/probe-head')).toBe(1);
      expect(s.api.requestCount('OPTIONS', '/probe-options')).toBe(1);
      expect(headA.id()).toBe(headB.id());
      expect(optionsA.id()).toBe(optionsB.id());
      expect(headA.response()).toEqual({ ok: true });
      expect(optionsB.response()).toEqual({ allow: 'GET' });

      a.destroy();
      b.destroy();
    });

    it('gives two same-route requests with different bodies two cache entries', () => {
      const s = scenario();
      s.api.on('GET', '/search', ({ body }) => ({ body: { echo: body } }));

      const search = s.get<{ response: { echo: unknown }; body: { term: string } }>('/search');

      const a = s.consumer();
      const b = s.consumer();
      const c = s.consumer();
      const ada = a.run(() => search(withArgs(() => ({ body: { term: 'ada' } }))));
      const adaAgain = b.run(() => search(withArgs(() => ({ body: { term: 'ada' } }))));
      const bob = c.run(() => search(withArgs(() => ({ body: { term: 'bob' } }))));

      s.tick();

      expect(s.api.requestCount('GET', '/search')).toBe(2);
      expect(ada.id()).toBe(adaAgain.id());
      expect(bob.id()).not.toBe(ada.id());
      expect(bob.response()).toEqual({ echo: { term: 'bob' } });

      a.destroy();
      b.destroy();
      c.destroy();
    });
  });

  describe('keepUnusedFor default', () => {
    const scenario = useScenario();

    it('retains an orphaned entry for five minutes with no keepUnusedFor configured', () => {
      const s = scenario();
      s.api.on('GET', '/default-retention', () => ({ body: { n: 1 } }));

      const getEntry = s.get<{ response: { n: number } }>('/default-retention');

      const c = s.consumer();
      c.run(() => getEntry());
      s.tick();

      c.destroy();

      s.tick(299_999);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(1);

      s.tick(2);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
    });
  });

  describe('what retention covers', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 5_000 } });

    it('lets a creator opt one query out of retention while the client retains the rest', () => {
      const s = scenario();
      s.api.on('GET', '/huge-report', () => ({ body: { n: 1 } }));
      s.api.on('GET', '/small-report', () => ({ body: { n: 2 } }));

      const getHugeReport = s.get<{ response: { n: number } }>('/huge-report', { keepUnusedFor: 0 });
      const getSmallReport = s.get<{ response: { n: number } }>('/small-report');

      const a = s.consumer();
      const b = s.consumer();
      const huge = a.run(() => getHugeReport());
      const small = b.run(() => getSmallReport());
      s.tick();

      const hugeKey = huge.id();
      const smallKey = small.id();

      a.destroy();
      b.destroy();

      expect(hugeKey).not.toBe(smallKey);
      expect(s.client.repository.subtle.cacheEntries().map((entry) => entry.key)).toEqual([smallKey]);

      s.tick(5_001);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
    });

    it('retains an authenticated response that carries no freshness header at all', async () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/secure/**');
      s.api.on('GET', '/secure/me', () => ({
        body: { id: 'me' },
        headers: { 'cache-control': 'no-store, private' },
      }));

      const getMe = createSecureGetQuery(s.clientRef, auth.ref)<{ response: { id: string } }>('/secure/me');

      const a = s.consumer();
      a.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();

      const first = a.run(() => getMe());
      await s.settle();
      expect(first.response()).toEqual({ id: 'me' });

      a.destroy();

      expect(s.client.repository.subtle.cacheEntries()).toContainEqual(
        expect.objectContaining({ isSecure: true, isUnused: true }),
      );

      s.tick(2_000);

      const b = s.consumer();
      const second = b.run(() => getMe());

      // `no-store` makes the header-derived TTL null, so this response can only come from retention.
      expect(second.response()).toEqual({ id: 'me' });

      await s.settle();
      b.destroy();
      s.tick(5_001);
    });

    it('destroys an entry that only ever errored instead of retaining it', () => {
      const s = scenario();
      s.api.on('GET', '/broken', () => ({ status: 500, body: { message: 'boom' } }));

      const getBroken = s.get<{ response: { n: number } }>('/broken');

      const c = s.consumer();
      const query = c.run(() => getBroken());
      s.tick();

      expect(query.error()).not.toBeNull();
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(1);

      c.destroy();

      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    });

    it('drops a retained secure entry on logout instead of letting it sit out its window', async () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/secure/**');
      s.api.on('GET', '/secure/me', () => ({ body: { id: 'me' } }));

      const getMe = createSecureGetQuery(s.clientRef, auth.ref)<{ response: { id: string } }>('/secure/me');

      const a = s.consumer();
      a.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();

      const secure = a.run(() => getMe());
      await s.settle();
      const secureKey = secure.id();

      a.destroy();

      expect(s.client.repository.subtle.cacheEntries().map((entry) => entry.key)).toContain(secureKey);

      s.run(() => auth.logout());
      await s.settle();

      expect(s.client.repository.subtle.cacheEntries().map((entry) => entry.key)).not.toContain(secureKey);
    });

    it('re-requests when a query rebinds to a still-fresh entry, while an allowCache execute serves it', () => {
      const s = scenario();
      const headers = { 'cache-control': 'max-age=20' };
      s.api.on(
        'GET',
        '/still-fresh',
        sequence([
          { body: { n: 1 }, headers },
          { body: { n: 2 }, headers },
        ]),
      );

      const getStillFresh = s.get<{ response: { n: number } }>('/still-fresh');

      const a = s.consumer();
      a.run(() => getStillFresh());
      s.tick();
      expect(s.api.requestCount('GET', '/still-fresh')).toBe(1);
      a.destroy();

      s.tick(1_000);

      const b = s.consumer();
      const query = b.run(() => getStillFresh());

      expect(query.response()).toEqual({ n: 1 });

      s.tick();

      expect(s.api.requestCount('GET', '/still-fresh')).toBe(2);
      expect(query.response()).toEqual({ n: 2 });

      query.execute({ options: { allowCache: true } });
      s.tick();

      expect(s.api.requestCount('GET', '/still-fresh')).toBe(2);
      expect(query.response()).toEqual({ n: 2 });

      b.destroy();
      s.tick(5_001);
    });
  });

  describe('freshness derived from response headers', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it.each<{ name: string; headers: Record<string, string>; freshAt: number | null; staleAt: number }>([
      { name: 'no-store', headers: { 'cache-control': 'no-store' }, freshAt: null, staleAt: 0 },
      { name: 'no-cache', headers: { 'cache-control': 'no-cache' }, freshAt: null, staleAt: 0 },
      { name: 'max-age=0', headers: { 'cache-control': 'max-age=0' }, freshAt: null, staleAt: 0 },
      { name: 's-maxage=20', headers: { 'cache-control': 's-maxage=20' }, freshAt: 9_000, staleAt: 10_001 },
      {
        name: 'max-age=20 with age=5',
        headers: { 'cache-control': 'max-age=20', age: '5' },
        freshAt: 14_000,
        staleAt: 15_001,
      },
    ])('derives the freshness window from $name', ({ headers, freshAt, staleAt }) => {
      const s = scenario();
      s.api.on(
        'GET',
        '/ttl',
        sequence([
          { body: { n: 1 }, headers },
          { body: { n: 2 }, headers },
        ]),
      );

      const getTtl = s.get<{ response: { n: number } }>('/ttl');

      const c = s.consumer();
      const query = c.run(() => getTtl());
      s.tick();
      expect(s.api.requestCount('GET', '/ttl')).toBe(1);

      let elapsed = 0;

      if (freshAt !== null) {
        s.tick(freshAt);
        elapsed = freshAt;
        query.execute({ options: { allowCache: true } });
        s.tick();
        expect(s.api.requestCount('GET', '/ttl')).toBe(1);
      }

      s.tick(staleAt - elapsed);
      query.execute({ options: { allowCache: true } });
      s.tick();

      expect(s.api.requestCount('GET', '/ttl')).toBe(2);
      expect(query.response()).toEqual({ n: 2 });

      c.destroy();
    });

    it('derives the freshness window from an expires header', () => {
      const s = scenario();
      s.api.on('GET', '/expires', () => ({
        body: { n: 1 },
        headers: { expires: new Date(Date.now() + 30_000).toUTCString() },
      }));

      const getExpires = s.get<{ response: { n: number } }>('/expires');

      const c = s.consumer();
      const query = c.run(() => getExpires());
      s.tick();
      expect(s.api.requestCount('GET', '/expires')).toBe(1);

      // `expires` is second precision, so the window ends within a second of 30s either way.
      s.tick(25_000);
      query.execute({ options: { allowCache: true } });
      s.tick();
      expect(s.api.requestCount('GET', '/expires')).toBe(1);

      s.tick(6_000);
      query.execute({ options: { allowCache: true } });
      s.tick();
      expect(s.api.requestCount('GET', '/expires')).toBe(2);

      c.destroy();
    });
  });

  describe('what refreshQueriesInUse covers', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('refreshQueriesInUse re-requests an entry that is still inside its freshness window', () => {
      const s = scenario();
      s.api.on(
        'GET',
        '/tenant-data',
        sequence([
          { body: { n: 1 }, headers: { 'cache-control': 'max-age=20' } },
          { body: { n: 2 }, headers: { 'cache-control': 'max-age=20' } },
        ]),
      );

      const getTenantData = s.get<{ response: { n: number } }>('/tenant-data');

      const c = s.consumer();
      const query = c.run(() => getTenantData());
      s.tick();
      expect(s.api.requestCount('GET', '/tenant-data')).toBe(1);

      // Well inside the 10s window an `allowCache` execute would be served from the cache.
      s.tick(1_000);
      s.client.refreshQueriesInUse();
      s.tick();

      expect(s.api.requestCount('GET', '/tenant-data')).toBe(2);
      expect(query.response()).toEqual({ n: 2 });

      c.destroy();
    });

    it('refreshes a HEAD and an OPTIONS read alongside the GETs', () => {
      const s = scenario();
      s.api.on('GET', '/mixed-get', () => ({ body: { n: 1 } }));
      s.api.on('HEAD', '/mixed-head', () => ({ body: { n: 1 } }));
      s.api.on('OPTIONS', '/mixed-options', () => ({ body: { n: 1 } }));

      const getMixed = s.get<{ response: { n: number } }>('/mixed-get');
      const headMixed = s.head<{ response: { n: number } }>('/mixed-head');
      const optionsMixed = s.options<{ response: { n: number } }>('/mixed-options');

      const c = s.consumer();
      c.run(() => getMixed());
      c.run(() => headMixed());
      c.run(() => optionsMixed());
      s.tick();

      s.client.refreshQueriesInUse();
      s.tick();

      expect(s.api.requestCount('GET', '/mixed-get')).toBe(2);
      expect(s.api.requestCount('HEAD', '/mixed-head')).toBe(2);
      expect(s.api.requestCount('OPTIONS', '/mixed-options')).toBe(2);

      c.destroy();
    });

    it('never replays a cached login POST when refreshQueriesInUse runs', async () => {
      const s = scenario();
      const auth = s.auth();
      s.api.on('GET', '/dashboard', () => ({ body: { n: 1 } }));

      const getDashboard = s.get<{ response: { n: number } }>('/dashboard');

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();

      c.run(() => getDashboard());
      await s.settle();

      expect(s.client.repository.subtle.cacheEntries().some((entry) => entry.request.method === 'POST')).toBe(true);

      s.client.refreshQueriesInUse();
      await s.settle();

      expect(s.api.requestCount('POST', '/auth/login')).toBe(1);
      expect(s.api.requestCount('GET', '/dashboard')).toBe(2);

      c.destroy();
    });
  });

  describe('invalidateQueries narrowing', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('applies the invalidation filter after url and only to the queries it accepts', () => {
      const s = scenario();
      s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'] } }));
      s.api.on('GET', '/teams/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getPlayer = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);
      const getTeam = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/teams/${p.id}`);

      const c = s.consumer();
      c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
      c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '2' } }))));
      c.run(() => getTeam(withArgs(() => ({ pathParams: { id: '9' } }))));
      s.tick();

      const seen: QueryInvalidationCandidate[] = [];

      s.client.invalidateQueries({
        url: '/players',
        filter: (query) => {
          seen.push(query);

          return query.url.endsWith('/1');
        },
      });
      s.tick();

      expect(seen.map((query) => query.url).sort()).toEqual([
        'https://api.test/players/1',
        'https://api.test/players/2',
      ]);
      expect(seen.every((query) => query.method === 'GET')).toBe(true);
      expect(s.api.requestCount('GET', '/players/1')).toBe(2);
      expect(s.api.requestCount('GET', '/players/2')).toBe(1);
      expect(s.api.requestCount('GET', '/teams/9')).toBe(1);

      c.destroy();
    });

    it('ignores otherTabs and invalidates locally when the multi-tab feature is absent', () => {
      const s = scenario();
      s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getPlayer = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);

      const c = s.consumer();
      c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
      s.tick();

      s.client.invalidateQueries({ url: '/players', otherTabs: true });
      s.tick();

      expect(s.api.requestCount('GET', '/players/1')).toBe(2);
      expect(s.errors).toEqual([]);

      c.destroy();
    });

    it('matches /players against /players?page=2 but not /players-archive', () => {
      const s = scenario();
      s.api.on('GET', '/players', ({ query }) => ({ body: { page: query['page'] ?? null } }));
      s.api.on('GET', '/players/:id', ({ params }) => ({ body: { page: params['id'] } }));
      s.api.on('GET', '/players-archive', () => ({ body: { page: 'archive' } }));

      const getPlayers = s.get<{ response: { page: string | null } }>('/players');
      const getPlayersPage = s.get<{ response: { page: string | null }; queryParams: { page: number } }>('/players');
      const getPlayer = s.get<{ response: { page: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);
      const getArchive = s.get<{ response: { page: string } }>('/players-archive');

      const listRequests = () => s.api.requests.filter((r) => r.path === '/players' && !r.query['page']).length;
      const pagedRequests = () => s.api.requests.filter((r) => r.path === '/players' && r.query['page'] === '2').length;

      const c = s.consumer();
      c.run(() => getPlayers());
      c.run(() => getPlayersPage(withArgs(() => ({ queryParams: { page: 2 } }))));
      c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
      c.run(() => getArchive());
      s.tick();

      const listBefore = listRequests();
      const pagedBefore = pagedRequests();

      s.client.invalidateQueries({ url: '/players' });
      s.tick();

      expect(listRequests()).toBe(listBefore + 1);
      expect(pagedRequests()).toBe(pagedBefore + 1);
      expect(s.api.requestCount('GET', '/players/1')).toBe(2);
      expect(s.api.requestCount('GET', '/players-archive')).toBe(1);

      c.destroy();
    });

    it('invalidateQueries() with no options re-runs every read in use', () => {
      const s = scenario();
      s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'] } }));
      s.api.on('GET', '/teams/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getPlayer = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);
      const getTeam = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/teams/${p.id}`);

      const c = s.consumer();
      c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
      c.run(() => getTeam(withArgs(() => ({ pathParams: { id: '9' } }))));

      const orphan = s.consumer();
      orphan.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '2' } }))));

      s.tick();
      orphan.destroy();

      s.client.invalidateQueries();
      s.tick();

      expect(s.api.requestCount('GET', '/players/1')).toBe(2);
      expect(s.api.requestCount('GET', '/teams/9')).toBe(2);
      expect(s.api.requestCount('GET', '/players/2')).toBe(1);

      c.destroy();
    });

    it('records one invalidation event naming every cache entry it re-executed', () => {
      const s = scenario();
      s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'] } }));
      s.api.on('GET', '/teams/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getPlayer = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);
      const getTeam = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/teams/${p.id}`);

      const c = s.consumer();
      c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
      c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '2' } }))));
      c.run(() => getTeam(withArgs(() => ({ pathParams: { id: '9' } }))));
      s.tick();

      const refreshEvents: Extract<QueryRepositoryEvent, { type: 'queries-refreshed' }>[] = [];
      const subscription = s.client.repository.events$.subscribe((event) => {
        if (event.type === 'queries-refreshed') refreshEvents.push(event);
      });

      s.client.invalidateQueries({ url: '/players' });
      s.tick();

      expect(refreshEvents).toHaveLength(1);
      expect(refreshEvents[0]?.cause).toEqual({
        type: 'invalidation',
        url: 'https://api.test/players',
        otherTab: false,
      });
      expect(refreshEvents[0]?.requests.map((request) => request.url).sort()).toEqual([
        'https://api.test/players/1',
        'https://api.test/players/2',
      ]);

      subscription.unsubscribe();
      c.destroy();
    });
  });

  describe('a filter never crosses the channel', () => {
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
      clientFeatures: [withMultiTabSync({ channelName: FILTER_CHANNEL })],
    });

    it('invalidates a superset in the other tab because the filter stays local', async () => {
      const s = scenario();
      s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const tabB = createSecondTab(s);
      const getPlayer = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);
      const getPlayerB = tabB.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/players/${p.id}`);

      const a = s.consumer();
      const b = tabB.consumer();
      a.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
      a.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '2' } }))));
      b.run(() => getPlayerB(withArgs(() => ({ pathParams: { id: '1' } }))));
      b.run(() => getPlayerB(withArgs(() => ({ pathParams: { id: '2' } }))));

      await s.settle();
      await flushMultiTabSync();

      const acceptedBefore = s.api.requestCount('GET', '/players/1');
      const rejectedBefore = s.api.requestCount('GET', '/players/2');

      s.client.invalidateQueries({ url: '/players', filter: (query) => query.url.endsWith('/1') });
      await s.settle();
      await flushMultiTabSync();
      await s.settle();

      // This tab honours the filter; the other tab receives the url alone and refreshes both entries.
      expect(s.api.requestCount('GET', '/players/1')).toBe(acceptedBefore + 2);
      expect(s.api.requestCount('GET', '/players/2')).toBe(rejectedBefore + 1);

      a.destroy();
      b.destroy();
      tabB.destroy();
    });
  });
});
