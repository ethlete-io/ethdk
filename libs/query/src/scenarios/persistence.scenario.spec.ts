import { HttpErrorResponse } from '@angular/common/http';
import { createFakeQueryPersistenceStore, FakeQueryPersistenceStoreHandle } from '@ethlete/query/testing';
import {
  createGetQuery,
  createGqlQueryViaPost,
  createQueryClient,
  createSecureGetQuery,
  gql,
  PersistedQueryEntry,
  QueryPersistenceAdapter,
  withQueryPersistence,
} from '../index';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sequence, useScenario } from './harness';

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
});
