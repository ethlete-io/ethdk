import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, inject, PLATFORM_ID } from '@angular/core';
import {
  createFakeQueryPersistenceStore,
  FakeBroadcastChannelHandle,
  FakeQueryPersistenceStoreHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import {
  createBearerAuthProvider,
  createGetQuery,
  createGqlMutationViaPost,
  createGqlQueryViaPost,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  gql,
  PersistedQueryEntry,
  QueryPersistenceAdapter,
  QueryPersistenceCandidate,
  withAuthenticationQuery,
  withBearerAuthMultiTabSync,
  withDefaultRetry,
  withLogging,
  withQueryPersistence,
  withRefreshQuery,
  withSuccessHandling,
} from '../index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mintToken, Scenario, sequence, useScenario } from './harness';

/**
 * Registered before `useScenario`'s `beforeEach` on purpose: the persistence engine reads the store
 * synchronously while the client is built, so the store must exist first.
 */
let store: FakeQueryPersistenceStoreHandle;

const persistedEntry = (entry: Pick<PersistedQueryEntry, 'key' | 'url' | 'persistedAt'>): PersistedQueryEntry => ({
  ...entry,
  expiresAt: null,
  isSecure: false,
  version: 1,
  method: 'GET',
  body: { key: entry.key },
});

const TAB_AUTH_PROVIDER_NAME = 'persistence-tab-auth';

type TabTokenArgs = { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } };

let tabCounter = 0;

/** One browser tab: its own persisted query client and auth provider, over the shared store and channel. */
const createPersistedTab = (s: Scenario) => {
  const clientRef = createQueryClient({
    name: `persistence-tab-client-${++tabCounter}`,
    baseUrl: 'https://api.test',
    keepUnusedFor: 0,
    features: [withQueryPersistence({ adapter: store.adapter })],
  });
  const authRef = createBearerAuthProvider({
    name: TAB_AUTH_PROVIDER_NAME,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: createPostQuery(clientRef)<TabTokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', {
        queryCreator: createPostQuery(clientRef)<TabTokenArgs>('/auth/refresh'),
        refreshStrategy: 0.5,
      }),
    ],
    features: [withBearerAuthMultiTabSync()],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());
  const client = injector.runInContext(() => clientRef.inject());

  if (!auth || !client) throw new Error('persistence scenario: failed to create the tab');

  const consumers: EnvironmentInjector[] = [];

  return {
    auth,
    client,
    get: createGetQuery(clientRef),
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

const syncTabs = async (s: Scenario) => {
  await s.settle();
  await flushMultiTabSync();
  await s.settle();
  await flushMultiTabSync();
  await s.settle();
};

describe('persistence scenario', () => {
  beforeEach(() => {
    store = createFakeQueryPersistenceStore();
  });

  describe('with persistence enabled', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter })],
    });

    it("renders last session's response before the network answers, then revalidates", async () => {
      const s = scenario();
      s.api.on('GET', '/dashboard', sequence([{ body: { widgets: 1 } }, { body: { widgets: 2 }, delay: 50 }]));

      const getDashboard = s.get<{ response: { widgets: number } }>('/dashboard');

      const first = s.consumer();
      first.run(() => getDashboard());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      const second = s.consumer();
      const query = second.run(() => getDashboard());

      expect(query.response()).toBeNull();
      expect(query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: false });

      await s.settle(0);

      expect(query.response()).toEqual({ widgets: 1 });
      expect(query.executionState()).toMatchObject({
        type: 'loading',
        hasCachedResponse: true,
        cachedResponse: { widgets: 1 },
      });

      s.tick(50);

      expect(query.response()).toEqual({ widgets: 2 });
      expect(query.executionState()).toMatchObject({ type: 'success' });
      expect(s.api.requestCount('GET', '/dashboard')).toBe(2);

      second.destroy();
    });

    it('keeps the persisted response and reports the error when revalidation fails', async () => {
      const s = scenario();
      s.api.on('GET', '/report', sequence([{ body: { rows: 1 } }, { status: 500, body: { message: 'nope' } }]));

      const getReport = s.get<{ response: { rows: number } }>('/report');

      const first = s.consumer();
      first.run(() => getReport());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      const second = s.consumer();
      const query = second.run(() => getReport());

      await s.settle(0);
      s.flush();

      expect(query.response()).toEqual({ rows: 1 });
      expect(query.error()).not.toBeNull();
      expect(query.executionState()).toMatchObject({ type: 'failure' });

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
      second.destroy();
    });

    it("writes a successful response to the store under the query's cache key", async () => {
      const s = scenario();
      s.api.on('GET', '/players', () => ({ body: { players: ['ada'] } }));

      const getPlayers = s.get<{ response: { players: string[] } }>('/players');

      const c = s.consumer();
      const query = c.run(() => getPlayers());
      s.tick();

      const key = query.id();
      if (!key) throw new Error('expected a repository key');

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries()).toEqual([
        expect.objectContaining({
          key,
          url: 'https://api.test/players',
          method: 'GET',
          isSecure: false,
          version: 1,
          body: { players: ['ada'] },
        }),
      ]);

      c.destroy();
    });

    it('does not persist a query that opted out', async () => {
      const s = scenario();
      s.api.on('GET', '/exports/full', () => ({ body: { huge: true } }));

      const getExport = s.get<{ response: { huge: boolean } }>('/exports/full', { persistence: false });

      const c = s.consumer();
      c.run(() => getExport());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries()).toEqual([]);

      c.destroy();
    });

    it('clearPersistedQueries empties the store', async () => {
      const s = scenario();
      s.api.on('GET', '/settings', () => ({ body: { theme: 'dark' } }));

      const getSettings = s.get<{ response: { theme: string } }>('/settings');

      const c = s.consumer();
      c.run(() => getSettings());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries().length).toBe(1);

      await s.client.clearPersistedQueries();

      expect(store.entries()).toEqual([]);

      c.destroy();
    });

    it('whenPersistenceReady resolves once the store index is loaded', async () => {
      const s = scenario();

      await s.client.whenPersistenceReady;

      expect(store.calls().loadIndex).toBe(1);
    });

    it('persists a shared entry as long as one bound consumer opted in, even if a sibling opted out', async () => {
      const s = scenario();
      s.api.on('GET', '/shared', () => ({ body: { v: 1 } }));

      const getPersisted = s.get<{ response: { v: number } }>('/shared');
      const getOptedOut = s.get<{ response: { v: number } }>('/shared', { persistence: false });

      const a = s.consumer();
      const b = s.consumer();

      try {
        a.run(() => getPersisted());
        b.run(() => getOptedOut());
        s.tick();

        await s.client.subtle.persistence?.flush();
        await s.settle();

        expect(s.api.requestCount('GET', '/shared')).toBe(1);
        expect(store.entries()).toHaveLength(1);
      } finally {
        a.destroy();
        b.destroy();
      }
    });

    it('a GraphQL query transported via POST is a read and is persisted like a GET', async () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: '1', name: 'Ada' } } } }));

      const getUser = createGqlQueryViaPost(s.clientRef)<{ response: { user: { id: string; name: string } } }>(gql`
        query GetUser {
          user(id: "1") {
            id
            name
          }
        }
      `);

      const c = s.consumer();
      const query = c.run(() => getUser());
      s.tick();

      expect(query.response()).toEqual({ user: { id: '1', name: 'Ada' } });

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries()).toEqual([expect.objectContaining({ method: 'POST', url: 'https://api.test' })]);

      c.destroy();
    });

    it('a login mutation is never persisted', async () => {
      const s = scenario();
      const auth = s.auth();

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries()).toEqual([]);

      c.destroy();
    });

    it('never persists a GraphQL mutation sent over POST', async () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { renameUser: { ok: true } } } }));

      const renameUser = createGqlMutationViaPost(s.clientRef)<{
        response: { renameUser: { ok: boolean } };
        variables: { name: string };
      }>(gql`
        mutation RenameUser($name: String!) {
          renameUser(name: $name) {
            ok
          }
        }
      `);

      const c = s.consumer();
      const mutation = c.run(() => renameUser());
      mutation.execute({ args: { variables: { name: 'Ada' } } });
      s.tick();

      expect(mutation.response()).toEqual({ renameUser: { ok: true } });

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries()).toEqual([]);

      c.destroy();
    });

    it('reports failure with the persisted body still in hasCachedResponse and cachedResponse', async () => {
      const s = scenario();
      s.api.on('GET', '/orders', sequence([{ body: { orders: 2 } }, { status: 500, body: { message: 'nope' } }]));

      const getOrders = s.get<{ response: { orders: number } }>('/orders');

      const first = s.consumer();
      first.run(() => getOrders());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      const second = s.consumer();
      const query = second.run(() => getOrders());

      await s.settle(0);
      s.tick();

      expect(query.executionState()).toEqual({
        type: 'failure',
        error: expect.objectContaining({ code: 500 }),
        hasCachedResponse: true,
        cachedResponse: { orders: 2 },
      });

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
      second.destroy();
    });

    it('restores a persisted freshness window verbatim, so an allowCache execute on a hydrated entry skips the network', async () => {
      const s = scenario();
      s.api.on(
        'GET',
        '/prices',
        sequence([
          { body: { price: 1 }, headers: { 'cache-control': 'max-age=20' } },
          { status: 500, body: { message: 'down' } },
          { body: { price: 2 } },
        ]),
      );

      const getPrices = s.get<{ response: { price: number } }>('/prices');

      const first = s.consumer();
      const firstQuery = first.run(() => getPrices());
      s.tick();

      // max-age=20 halves to a 10s freshness window, stored as the instant that window ends.
      const expiresAt = Date.now() + 10_000;
      const key = firstQuery.id();
      if (!key) throw new Error('expected a repository key');

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entry(key)?.expiresAt).toBe(expiresAt);
      first.destroy();

      const second = s.consumer();
      const query = second.run(() => getPrices());

      await s.settle(0);
      s.tick();

      expect(query.response()).toEqual({ price: 1 });
      expect(s.api.requestCount('GET', '/prices')).toBe(2);

      query.execute({ options: { allowCache: true } });
      s.tick();

      expect(s.api.requestCount('GET', '/prices')).toBe(2);

      s.tick(10_000);
      query.execute({ options: { allowCache: true } });
      s.tick();

      expect(s.api.requestCount('GET', '/prices')).toBe(3);
      expect(query.response()).toEqual({ price: 2 });

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
      second.destroy();
    });

    it('still leaves the first tick empty after whenPersistenceReady resolved', async () => {
      const s = scenario();
      s.api.on('GET', '/profile', sequence([{ body: { name: 'ada' } }, { body: { name: 'ada' }, delay: 50 }]));

      const getProfile = s.get<{ response: { name: string } }>('/profile');

      const first = s.consumer();
      first.run(() => getProfile());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      await s.client.whenPersistenceReady;

      const second = s.consumer();
      const query = second.run(() => getProfile());

      expect(query.response()).toBeNull();
      expect(query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: false });

      await s.settle(0);

      expect(query.response()).toEqual({ name: 'ada' });

      s.tick(50);
      second.destroy();
    });

    it('writes nothing for a failed request, so the next cold start has nothing on disk', async () => {
      const s = scenario();
      s.api.on(
        'GET',
        '/reports/nightly',
        sequence([
          { status: 500, body: { message: 'down' } },
          { body: { rows: 3 }, delay: 50 },
        ]),
      );

      const getNightly = s.get<{ response: { rows: number } }>('/reports/nightly');

      const first = s.consumer();
      first.run(() => getNightly());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries()).toEqual([]);
      expect(store.calls().write).toBe(0);
      first.destroy();

      const second = s.consumer();
      const query = second.run(() => getNightly());

      await s.settle(0);

      expect(query.response()).toBeNull();
      expect(query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: false });
      expect(store.calls().read).toBe(0);

      s.tick(50);

      expect(query.response()).toEqual({ rows: 3 });

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
      second.destroy();
    });

    it('keeps side-effect features and the event stream quiet when an entry is hydrated from disk', async () => {
      const s = scenario();
      s.api.on('GET', '/inbox', sequence([{ body: { unread: 1 } }, { body: { unread: 2 }, delay: 50 }]));

      const getInbox = s.get<{ response: { unread: number } }>('/inbox');

      const first = s.consumer();
      first.run(() => getInbox());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      const successes: unknown[] = [];
      let loggedResponses = 0;

      const second = s.consumer();
      const query = second.run(() =>
        getInbox(
          withSuccessHandling({ handler: (r) => successes.push(r) }),
          withLogging({
            logFn: (event) => {
              if (event?.type === HttpEventType.Response) loggedResponses++;
            },
          }),
        ),
      );

      await s.settle(0);

      expect(query.response()).toEqual({ unread: 1 });
      expect(successes).toEqual([]);
      expect(loggedResponses).toBe(0);

      s.tick(50);

      expect(query.response()).toEqual({ unread: 2 });
      expect(successes).toEqual([{ unread: 2 }]);
      expect(loggedResponses).toBe(1);

      second.destroy();
    });
  });

  describe('authenticated responses', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter })],
    });

    it('are not persisted by default, are persisted when a query opts in, and are purged on logout', async () => {
      const s = scenario();
      const auth = s.auth();

      s.api.protect('/secure/**');
      s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));
      s.api.on('GET', '/secure/dashboard', () => ({ body: { widgets: 1 } }));
      s.api.on('GET', '/public/info', () => ({ body: { version: 1 } }));

      const getSecureProfile = createSecureGetQuery(
        s.clientRef,
        auth.ref,
      )<{ response: { id: string } }>('/secure/profile');
      const getSecureDashboard = createSecureGetQuery(s.clientRef, auth.ref)<{ response: { widgets: number } }>(
        '/secure/dashboard',
        { persistence: true },
      );
      const getPublicInfo = s.get<{ response: { version: number } }>('/public/info');

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();

      c.run(() => getSecureProfile());
      c.run(() => getSecureDashboard());
      c.run(() => getPublicInfo());
      s.tick();

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(
        store
          .entries()
          .map((e) => e.url)
          .sort(),
      ).toEqual(['https://api.test/public/info', 'https://api.test/secure/dashboard']);

      s.run(() => auth.logout());
      await s.settle();

      expect(store.entries().map((e) => e.url)).toEqual(['https://api.test/public/info']);

      c.destroy();
    });
  });

  describe('version bump', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter, version: 1 })],
    });

    it('ignores an entry written under a different version and forgets it', async () => {
      const s = scenario();
      s.api.on('GET', '/config', sequence([{ body: { schema: 'v1' } }, { body: { schema: 'v2' } }]));

      const getConfig = s.get<{ response: { schema: string } }>('/config');

      const first = s.consumer();
      first.run(() => getConfig());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries().length).toBe(1);
      first.destroy();

      const secondRef = createQueryClient({
        name: 'persistence-version-bump-reader',
        baseUrl: 'https://api.test',
        keepUnusedFor: 0,
        features: [withQueryPersistence({ adapter: store.adapter, version: 2 })],
      });
      const secondClient = s.run(() => secondRef.inject());
      if (!secondClient) throw new Error('expected the second client to be created');

      const getConfigV2 = createGetQuery(secondRef)<{ response: { schema: string } }>('/config');
      const second = s.consumer();
      const query = second.run(() => getConfigV2());
      s.tick();

      expect(query.response()).toEqual({ schema: 'v2' });

      await s.settle();

      expect(store.entries()).toEqual([]);
      expect(store.calls().clear).toBe(1);

      await secondClient.subtle.persistence?.flush();
      await s.settle();
      second.destroy();
    });
  });

  describe('a write that lands before the store index has loaded', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter, version: 1 })],
    });

    it('survives the startup pruning of a client with a bumped version', async () => {
      const s = scenario();
      s.api.on('GET', '/config', sequence([{ body: { schema: 'v1' } }, { body: { schema: 'v2' } }]));

      const getConfig = s.get<{ response: { schema: string } }>('/config');

      const first = s.consumer();
      const firstQuery = first.run(() => getConfig());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();

      const key = firstQuery.id();
      if (!key) throw new Error('expected a repository key');
      expect(store.entry(key)?.version).toBe(1);
      first.destroy();

      const pendingIndexLoads: (() => void)[] = [];
      const slowIndexAdapter: QueryPersistenceAdapter = {
        ...store.adapter,
        loadIndex: () => {
          const snapshot = store.adapter.loadIndex();

          return new Promise((resolve) => {
            pendingIndexLoads.push(() => void snapshot.then(resolve));
          });
        },
      };

      const secondRef = createQueryClient({
        name: 'persistence-early-write-reader',
        baseUrl: 'https://api.test',
        keepUnusedFor: 0,
        features: [withQueryPersistence({ adapter: slowIndexAdapter, version: 2 })],
      });
      const secondClient = s.run(() => secondRef.inject());
      if (!secondClient) throw new Error('expected the second client to be created');

      const getConfigV2 = createGetQuery(secondRef)<{ response: { schema: string } }>('/config');
      const second = s.consumer();
      const query = second.run(() => getConfigV2());
      s.tick();

      expect(query.response()).toEqual({ schema: 'v2' });

      s.tick(1000);
      await s.settle();

      expect(store.entry(key)).toMatchObject({ version: 2, body: { schema: 'v2' } });

      const releaseIndex = pendingIndexLoads.shift();

      if (!releaseIndex) throw new Error('expected the index load to be pending');
      releaseIndex();
      await secondClient.whenPersistenceReady;
      await s.settle();

      expect(store.entry(key)).toMatchObject({ version: 2, body: { schema: 'v2' } });

      second.destroy();
    });
  });

  describe('maxEntries', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter, maxEntries: 2 })],
    });

    it('evicts the least recently written entries once a write pushes the store over the cap', async () => {
      const s = scenario();
      s.api.on('GET', '/a', () => ({ body: { a: 1 } }));
      s.api.on('GET', '/b', () => ({ body: { b: 1 } }));
      s.api.on('GET', '/c', () => ({ body: { c: 1 } }));

      const getA = s.get<{ response: { a: number } }>('/a');
      const getB = s.get<{ response: { b: number } }>('/b');
      const getC = s.get<{ response: { c: number } }>('/c');

      const c = s.consumer();
      c.run(() => getA());
      s.tick(10);
      c.run(() => getB());
      s.tick(10);
      c.run(() => getC());
      s.tick();

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries().map((e) => e.url)).toEqual(['https://api.test/b', 'https://api.test/c']);

      c.destroy();
    });
  });

  describe('maxEntries at startup', () => {
    beforeEach(() => {
      const now = Date.now();

      store.seed([
        persistedEntry({ key: 'oldest', url: 'https://api.test/1', persistedAt: now - 3000 }),
        persistedEntry({ key: 'middle', url: 'https://api.test/2', persistedAt: now - 2000 }),
        persistedEntry({ key: 'newest', url: 'https://api.test/3', persistedAt: now - 1000 }),
      ]);
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter, maxEntries: 2 })],
    });

    it('re-applies a lowered cap to a store left over the limit, oldest first', async () => {
      const s = scenario();

      await s.client.whenPersistenceReady;
      await s.settle();

      expect(store.entries().map((e) => e.key)).toEqual(['middle', 'newest']);
      expect(store.calls().remove).toBe(1);
    });
  });

  describe('maxAge at startup', () => {
    beforeEach(() => {
      const now = Date.now();

      store.seed([
        persistedEntry({ key: 'stale', url: 'https://api.test/stale', persistedAt: now - 86_400_000 }),
        persistedEntry({ key: 'fresh', url: 'https://api.test/fresh', persistedAt: now - 1000 }),
      ]);
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter })],
    });

    it('drops an entry older than maxAge and keeps the rest', async () => {
      const s = scenario();

      await s.client.whenPersistenceReady;
      await s.settle();

      expect(store.entries().map((e) => e.key)).toEqual(['fresh']);
    });
  });

  describe('a failing write', () => {
    beforeEach(() => {
      const now = Date.now();

      store.seed([
        persistedEntry({ key: 'oldest', url: 'https://api.test/1', persistedAt: now - 2000 }),
        persistedEntry({ key: 'newer', url: 'https://api.test/2', persistedAt: now - 1000 }),
      ]);
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter })],
    });

    it('frees the oldest half of the store and retries once', async () => {
      const s = scenario();
      s.api.on('GET', '/new', () => ({ body: { fresh: true } }));

      await s.client.whenPersistenceReady;

      const getNew = s.get<{ response: { fresh: boolean } }>('/new');
      const c = s.consumer();
      c.run(() => getNew());
      s.tick();

      store.failNextWrites(1);
      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.calls().write).toBe(2);
      expect(store.calls().remove).toBe(1);
      expect(store.entries().map((e) => e.url)).toEqual(['https://api.test/2', 'https://api.test/new']);

      c.destroy();
    });

    it('stops writing for the session after a second failure, with one dev-mode warning, and queries are unaffected', async () => {
      const s = scenario();
      s.api.on('GET', '/first', () => ({ body: { n: 1 } }));
      s.api.on('GET', '/later', () => ({ body: { n: 2 } }));

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        await s.client.whenPersistenceReady;

        const getFirst = s.get<{ response: { n: number } }>('/first');
        const getLater = s.get<{ response: { n: number } }>('/later');
        const c = s.consumer();
        const first = c.run(() => getFirst());
        s.tick();

        store.failNextWrites(2);
        await s.client.subtle.persistence?.flush();
        await s.settle();

        expect(first.response()).toEqual({ n: 1 });
        expect(store.calls().write).toBe(2);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0]?.[0])).toContain('disabled for this session');

        const later = c.run(() => getLater());
        s.tick();
        await s.client.subtle.persistence?.flush();
        await s.settle();

        expect(later.response()).toEqual({ n: 2 });
        expect(store.calls().write).toBe(2);
        expect(store.entries().map((e) => e.url)).toEqual(['https://api.test/2']);

        c.destroy();
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('writeDelay', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter, writeDelay: 1000 })],
    });

    it('collects writes for writeDelay before one batched flush', async () => {
      const s = scenario();
      s.api.on('GET', '/a', () => ({ body: { a: 1 } }));
      s.api.on('GET', '/b', () => ({ body: { b: 1 } }));

      const getA = s.get<{ response: { a: number } }>('/a');
      const getB = s.get<{ response: { b: number } }>('/b');

      const c = s.consumer();
      c.run(() => getA());
      c.run(() => getB());
      s.tick();
      s.tick(500);
      await s.settle();

      expect(store.calls().write).toBe(0);

      s.tick(500);
      await s.settle();

      expect(store.calls().write).toBe(1);
      expect(store.entries()).toHaveLength(2);

      c.destroy();
    });

    it('flushes at once when the tab hides', async () => {
      const s = scenario();
      s.api.on('GET', '/a', () => ({ body: { a: 1 } }));

      const getA = s.get<{ response: { a: number } }>('/a');

      const c = s.consumer();
      c.run(() => getA());
      s.tick();

      expect(store.calls().write).toBe(0);

      const visibilityState = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });

      try {
        document.dispatchEvent(new Event('visibilitychange'));
        await s.settle();

        expect(store.calls().write).toBe(1);
      } finally {
        Reflect.deleteProperty(document, 'visibilityState');
        if (visibilityState) Object.defineProperty(Document.prototype, 'visibilityState', visibilityState);
      }

      c.destroy();
    });
  });

  describe('filter', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [
        withQueryPersistence({
          adapter: () => store.adapter,
          filter: ({ url }) => !new URL(url).pathname.startsWith('/admin'),
        }),
      ],
    });

    it('keeps a response out of the store when it returns false', async () => {
      const s = scenario();
      s.api.on('GET', '/admin/users', () => ({ body: { users: [] } }));
      s.api.on('GET', '/public/info', () => ({ body: { version: 1 } }));

      const getAdminUsers = s.get<{ response: { users: unknown[] } }>('/admin/users');
      const getPublicInfo = s.get<{ response: { version: number } }>('/public/info');

      const c = s.consumer();
      c.run(() => getAdminUsers());
      c.run(() => getPublicInfo());
      s.tick();

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries().map((e) => e.url)).toEqual(['https://api.test/public/info']);

      c.destroy();
    });
  });

  describe('a custom adapter', () => {
    let disk: Map<string, PersistedQueryEntry>;
    let failReads: boolean;
    let reads: number;

    beforeEach(() => {
      disk = new Map();
      failReads = false;
      reads = 0;
    });

    const adapter = (): QueryPersistenceAdapter => ({
      loadIndex: async () =>
        Array.from(disk.values()).map(({ key, url, method, isSecure, version, persistedAt, expiresAt }) => ({
          key,
          url,
          method,
          isSecure,
          version,
          persistedAt,
          expiresAt,
        })),
      read: async (key) => {
        reads++;

        if (failReads) throw new Error('disk unreadable');

        const entry = disk.get(key);

        return entry ? { body: entry.body } : null;
      },
      write: async (entries) => {
        for (const entry of entries) disk.set(entry.key, entry);
      },
      remove: async (keys) => {
        for (const key of keys) disk.delete(key);
      },
      clear: async () => disk.clear(),
      isSupported: true,
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter })],
    });

    it('receives the finished entries and hands a body back on a cold mount', async () => {
      const s = scenario();
      s.api.on('GET', '/dashboard', sequence([{ body: { widgets: 1 } }, { body: { widgets: 2 }, delay: 50 }]));

      const getDashboard = s.get<{ response: { widgets: number } }>('/dashboard');

      const first = s.consumer();
      const firstQuery = first.run(() => getDashboard());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      const key = firstQuery.id();
      if (!key) throw new Error('expected a repository key');
      expect(disk.get(key)).toMatchObject({ url: 'https://api.test/dashboard', method: 'GET', body: { widgets: 1 } });

      const second = s.consumer();
      const query = second.run(() => getDashboard());
      await s.settle(0);

      expect(reads).toBe(1);
      expect(query.response()).toEqual({ widgets: 1 });

      s.tick(50);
      expect(query.response()).toEqual({ widgets: 2 });

      second.destroy();
    });

    it('treats a failing read as a miss', async () => {
      const s = scenario();
      s.api.on('GET', '/report', sequence([{ body: { rows: 1 } }, { body: { rows: 2 }, delay: 50 }]));

      const getReport = s.get<{ response: { rows: number } }>('/report');

      const first = s.consumer();
      first.run(() => getReport());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      failReads = true;

      const second = s.consumer();
      const query = second.run(() => getReport());
      await s.settle(0);

      expect(reads).toBe(1);
      expect(query.response()).toBeNull();
      expect(query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: false });

      s.tick(50);
      expect(query.response()).toEqual({ rows: 2 });
      expect(query.error()).toBeNull();

      second.destroy();
    });
  });
  describe('an offline revalidation with the default retry policy', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter }), withDefaultRetry({ jitter: 0 })],
    });

    it('stays loading with the persisted response on screen for the whole retry window, then fails', async () => {
      const s = scenario();
      s.api.on('GET', '/feed', sequence([{ body: { items: 1 } }, { status: 0 }]));

      const getFeed = s.get<{ response: { items: number } }>('/feed');

      const first = s.consumer();
      first.run(() => getFeed());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      const second = s.consumer();
      const query = second.run(() => getFeed());

      await s.settle(0);

      expect(query.executionState()).toMatchObject({
        type: 'loading',
        hasCachedResponse: true,
        cachedResponse: { items: 1 },
      });

      // The retry policy backs off by 2s, 4s and 8s. Each stage needs the extra 1ms tick that lets the
      // attempt sent on the boundary answer through its own zero-delay response timer.
      for (const backoff of [2_000, 4_000]) {
        s.tick(backoff);
        s.tick(1);

        expect(query.response()).toEqual({ items: 1 });
        expect(query.executionState()).toMatchObject({
          type: 'loading',
          hasCachedResponse: true,
          cachedResponse: { items: 1 },
        });
      }

      s.tick(8_000);
      s.tick(1);

      expect(s.api.requestCount('GET', '/feed')).toBe(5);
      expect(query.executionState()).toMatchObject({
        type: 'failure',
        hasCachedResponse: true,
        cachedResponse: { items: 1 },
      });

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 0);
      second.destroy();
    });
  });

  describe('the default maxAge', () => {
    beforeEach(() => {
      const now = Date.now();

      store.seed([
        persistedEntry({ key: 'just-inside', url: 'https://api.test/inside', persistedAt: now - 86_399_000 }),
        persistedEntry({ key: 'just-outside', url: 'https://api.test/outside', persistedAt: now - 86_400_001 }),
      ]);
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter })],
    });

    it('drops an entry older than the default 24h maxAge at startup', async () => {
      const s = scenario();

      await s.client.whenPersistenceReady;
      await s.settle();

      expect(store.entries().map((e) => e.key)).toEqual(['just-inside']);
    });
  });

  describe('the filter candidate', () => {
    let candidates: QueryPersistenceCandidate[] = [];

    beforeEach(() => {
      candidates = [];
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [
        withQueryPersistence({
          adapter: () => store.adapter,
          filter: (candidate) => {
            candidates.push(candidate);

            return true;
          },
        }),
      ],
    });

    it('hands the filter the key, url, method and isSecure of each candidate', async () => {
      const s = scenario();
      const auth = s.auth();

      s.api.protect('/secure/**');
      s.api.on('GET', '/secure/me', () => ({ body: { id: 'me' } }));
      s.api.on('GET', '/public/info', () => ({ body: { version: 1 } }));

      const getMe = createSecureGetQuery(s.clientRef, auth.ref)<{ response: { id: string } }>('/secure/me', {
        persistence: true,
      });
      const getInfo = s.get<{ response: { version: number } }>('/public/info');

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();

      const me = c.run(() => getMe());
      const info = c.run(() => getInfo());
      s.tick();
      await s.settle();

      expect(candidates).toHaveLength(2);
      expect(candidates.find((candidate) => candidate.isSecure)).toEqual({
        key: me.id(),
        url: 'https://api.test/secure/me',
        method: 'GET',
        isSecure: true,
      });
      expect(candidates.find((candidate) => !candidate.isSecure)).toEqual({
        key: info.id(),
        url: 'https://api.test/public/info',
        method: 'GET',
        isSecure: false,
      });

      c.destroy();
    });
  });

  describe('a client without the persistence feature', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('resolves whenPersistenceReady immediately for a client without the persistence feature', async () => {
      const s = scenario();
      let isReady = false;

      void s.client.whenPersistenceReady.then(() => (isReady = true));
      await Promise.resolve();

      expect(isReady).toBe(true);
      expect(s.client.subtle.persistence).toBeNull();
      expect(store.calls()).toEqual({ loadIndex: 0, read: 0, write: 0, remove: 0, clear: 0 });
    });
  });

  describe('server-side rendering', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter })],
      providers: () => [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    it('opens no store and calls no adapter method on the server', async () => {
      const s = scenario();
      s.api.on('GET', '/page', () => ({ body: { title: 'home' } }));

      const getPage = s.get<{ response: { title: string } }>('/page');

      const c = s.consumer();
      const query = c.run(() => getPage());
      s.tick();

      expect(query.response()).toEqual({ title: 'home' });

      await s.client.whenPersistenceReady;
      await s.settle();

      expect(s.client.subtle.persistence).toBeNull();
      expect(store.calls()).toEqual({ loadIndex: 0, read: 0, write: 0, remove: 0, clear: 0 });

      c.destroy();
    });
  });

  describe('storage the browser does not support', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => ({ ...store.adapter, isSupported: false }) })],
    });

    it('degrades to in-memory caching when the adapter reports isSupported: false', async () => {
      const s = scenario();
      s.api.on('GET', '/teams', () => ({ body: { teams: ['a'] } }));

      const getTeams = s.get<{ response: { teams: string[] } }>('/teams');

      await s.client.whenPersistenceReady;

      const a = s.consumer();
      const b = s.consumer();
      const queryA = a.run(() => getTeams());
      const queryB = b.run(() => getTeams());
      s.tick();

      expect(s.api.requestCount('GET', '/teams')).toBe(1);
      expect(queryA.response()).toEqual({ teams: ['a'] });
      expect(queryB.response()).toEqual(queryA.response());

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.calls()).toEqual({ loadIndex: 0, read: 0, write: 0, remove: 0, clear: 0 });

      a.destroy();
      b.destroy();
    });
  });

  describe('an index that fails to load', () => {
    beforeEach(() => {
      store.seed([persistedEntry({ key: 'left-over', url: 'https://api.test/left-over', persistedAt: Date.now() })]);
      store.failNextLoadIndex();
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter })],
    });

    it('treats an index that fails to load as an empty store and leaves queries unaffected', async () => {
      const s = scenario();
      s.api.on('GET', '/standings', () => ({ body: { rows: 4 } }));

      await s.client.whenPersistenceReady;

      const getStandings = s.get<{ response: { rows: number } }>('/standings');

      const c = s.consumer();
      const query = c.run(() => getStandings());
      s.tick();
      await s.settle();

      expect(query.response()).toEqual({ rows: 4 });
      expect(store.calls().read).toBe(0);

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries().map((e) => e.url)).toEqual(['https://api.test/left-over', 'https://api.test/standings']);

      c.destroy();
    });
  });

  describe('the default storage name', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('keeps two clients persisted entries apart under their default storage names', async () => {
      const s = scenario();
      const opened: string[] = [];
      const indexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

      // The database is opened on the engine's first index read, and the open request is never answered:
      // the name it asked for is the whole observation.
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: {
          open: (name: string) => {
            opened.push(name);

            return {} as IDBOpenDBRequest;
          },
        },
      });

      try {
        const defaultNameRef = createQueryClient({
          name: 'persistence-store-name-default',
          baseUrl: 'https://api.test',
          keepUnusedFor: 0,
          features: [withQueryPersistence()],
        });
        const customNameRef = createQueryClient({
          name: 'persistence-store-name-custom',
          baseUrl: 'https://api.test',
          keepUnusedFor: 0,
          features: [withQueryPersistence({ storageName: 'et-query-persistence-somewhere-else' })],
        });

        s.run(() => defaultNameRef.inject());
        s.run(() => customNameRef.inject());
        await s.settle();

        expect(opened).toEqual([
          'et-query-persistence-persistence-store-name-default',
          'et-query-persistence-somewhere-else',
        ]);
      } finally {
        Reflect.deleteProperty(globalThis, 'indexedDB');
        if (indexedDbDescriptor) Object.defineProperty(globalThis, 'indexedDB', indexedDbDescriptor);
      }
    });
  });

  describe('a removal that starts while a write is in flight', () => {
    let releaseWrite: (() => void) | null = null;

    beforeEach(() => {
      releaseWrite = null;
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [
        withQueryPersistence({
          adapter: () => ({
            ...store.adapter,
            write: async (entries) => {
              await new Promise<void>((resolve) => (releaseWrite = resolve));
              await store.adapter.write(entries);
            },
          }),
        }),
      ],
    });

    it('runs a clearPersistedQueries that starts mid-write after the write lands, so nothing survives it', async () => {
      const s = scenario();
      s.api.on('GET', '/notes', () => ({ body: { notes: ['one'] } }));

      const getNotes = s.get<{ response: { notes: string[] } }>('/notes');

      const c = s.consumer();
      c.run(() => getNotes());
      s.tick();

      s.tick(1000);
      await s.settle();

      expect(releaseWrite).not.toBeNull();

      const cleared = s.client.clearPersistedQueries();

      releaseWrite?.();
      await cleared;
      await s.settle();

      expect(store.calls().write).toBe(1);
      expect(store.calls().clear).toBe(1);
      expect(store.entries()).toEqual([]);

      c.destroy();
    });
  });

  describe('a logout in another tab', () => {
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

    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('purges the secure persisted entries of both tabs when one of them logs out', async () => {
      const s = scenario();
      s.api.on('POST', '/auth/login', () => ({
        body: {
          accessToken: mintToken({ expiresInMs: 15 * 60 * 1000 }),
          refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
        },
      }));
      s.api.protect('/secure/**');
      s.api.on('GET', '/secure/a', () => ({ body: { id: 'a' } }));
      s.api.on('GET', '/secure/b', () => ({ body: { id: 'b' } }));
      s.api.on('GET', '/public/info', () => ({ body: { version: 1 } }));

      const a = createPersistedTab(s);
      const b = createPersistedTab(s);
      await syncTabs(s);

      s.tick(251);
      await syncTabs(s);

      a.auth.queries.login.execute({ body: {} });
      await syncTabs(s);

      a.consumer().run(() => a.getSecure<{ response: { id: string } }>('/secure/a', { persistence: true })());
      b.consumer().run(() => b.getSecure<{ response: { id: string } }>('/secure/b', { persistence: true })());
      b.consumer().run(() => b.get<{ response: { version: number } }>('/public/info')());
      await syncTabs(s);

      await a.client.subtle.persistence?.flush();
      await b.client.subtle.persistence?.flush();
      await syncTabs(s);

      expect(
        store
          .entries()
          .map((e) => e.url)
          .sort(),
      ).toEqual(['https://api.test/public/info', 'https://api.test/secure/a', 'https://api.test/secure/b']);

      const removeCallsBeforeLogout = store.calls().remove;

      a.auth.logout();
      await syncTabs(s);

      expect(store.entries().map((e) => e.url)).toEqual(['https://api.test/public/info']);

      // One removal per tab: each engine only ever knows the keys it wrote itself.
      expect(store.calls().remove - removeCallsBeforeLogout).toBe(2);

      a.destroy();
      b.destroy();
    });
  });

  describe('a logout purge the store refuses', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter })],
    });

    it('never hydrates a secure entry whose logout removal failed', async () => {
      const s = scenario();
      const auth = s.auth();

      s.api.protect('/secure/**');
      s.api.on('GET', '/secure/profile', sequence([{ body: { id: 'ada' } }, { body: { id: 'grace' }, delay: 50 }]));

      const getSecureProfile = createSecureGetQuery(s.clientRef, auth.ref)<{ response: { id: string } }>(
        '/secure/profile',
        { persistence: true },
      );

      const first = s.consumer();
      first.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();
      first.run(() => getSecureProfile());
      s.tick();

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries().map((e) => e.url)).toEqual(['https://api.test/secure/profile']);

      store.failNextRemoves(1);
      s.run(() => auth.logout());
      await s.settle();
      first.destroy();

      const second = s.consumer();
      second.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();

      const query = second.run(() => getSecureProfile());
      await s.settle(0);

      expect(query.response()).toBeNull();

      s.tick(50);

      expect(query.response()).toEqual({ id: 'grace' });

      second.destroy();
    });
  });

  describe('a clearPersistedQueries that lands while a body is being read', () => {
    let releaseRead: (() => void) | null = null;

    beforeEach(() => {
      releaseRead = null;
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [
        withQueryPersistence({
          adapter: () => ({
            ...store.adapter,
            // A real disk read takes the body first and answers a moment later, which is the window
            // this test needs. The fake store would re-check the store after the delay instead.
            read: async (key) => {
              const body = await store.adapter.read(key);

              await new Promise<void>((resolve) => (releaseRead = resolve));

              return body;
            },
          }),
        }),
      ],
    });

    it('drops a hydration whose body was read before a clearPersistedQueries that finished first', async () => {
      const s = scenario();
      s.api.on('GET', '/notes', sequence([{ body: { notes: 1 } }, { body: { notes: 2 }, delay: 50 }]));

      const getNotes = s.get<{ response: { notes: number } }>('/notes');

      const first = s.consumer();
      first.run(() => getNotes());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      const second = s.consumer();
      const query = second.run(() => getNotes());
      await s.settle(0);

      expect(releaseRead).not.toBeNull();

      await s.client.clearPersistedQueries();

      releaseRead?.();
      await s.settle(0);

      expect(query.response()).toBeNull();
      expect(query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: false });

      s.tick(50);

      expect(query.response()).toEqual({ notes: 2 });

      second.destroy();
    });
  });

  describe('a store that stopped taking writes and was then cleared', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter })],
    });

    it('starts persisting again after clearPersistedQueries frees the store', async () => {
      const s = scenario();
      s.api.on('GET', '/first', () => ({ body: { n: 1 } }));
      s.api.on('GET', '/later', () => ({ body: { n: 2 } }));

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        await s.client.whenPersistenceReady;

        const getFirst = s.get<{ response: { n: number } }>('/first');
        const getLater = s.get<{ response: { n: number } }>('/later');

        const c = s.consumer();
        c.run(() => getFirst());
        s.tick();

        store.failNextWrites(2);
        await s.client.subtle.persistence?.flush();
        await s.settle();

        expect(store.calls().write).toBe(2);
        expect(store.entries()).toEqual([]);

        await s.client.clearPersistedQueries();

        c.run(() => getLater());
        s.tick();
        await s.client.subtle.persistence?.flush();
        await s.settle();

        expect(store.entries().map((e) => e.url)).toEqual(['https://api.test/later']);

        c.destroy();
      } finally {
        warn.mockRestore();
      }
    });
  });
});
