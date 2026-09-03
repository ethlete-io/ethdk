import { HttpErrorResponse } from '@angular/common/http';
import { createFakeQueryPersistenceStore, FakeQueryPersistenceStoreHandle } from '@ethlete/query/testing';
import { createGetQuery, createQueryClient, createSecureGetQuery, withQueryPersistence } from '../index';
import { beforeEach, describe, expect, it } from 'vitest';
import { sequence, useScenario } from './harness';

/**
 * Registered before `useScenario`'s `beforeEach` on purpose: the persistence engine reads the store
 * synchronously while the client is built, so the store must exist first.
 */
let store: FakeQueryPersistenceStoreHandle;

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

    it.fails(
      'an opted-out consumer of the same cache entry silently turns persistence off for a sibling that opted in - query-repository.ts:732 ANDs isPersistEnabled across every consumer of one key instead of deciding per query (scan finding: "An existing cache entry ignores the second consumer\'s configuration")',
      async () => {
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
      },
    );

    it.fails(
      'a login mutation is never persisted - bearer-auth-query-builders.ts opts login/refresh into `subtle.useQueryRepositoryCache` for state tracking, which also makes them default-eligible for persistence as an unintended side effect (docs: "Only successful reads. Mutations are never persisted")',
      async () => {
        const s = scenario();
        const auth = s.auth();

        const c = s.consumer();
        c.run(() => auth.queries.login.execute({ body: {} }));
        s.tick();

        await s.client.subtle.persistence?.flush();
        await s.settle();

        expect(store.entries()).toEqual([]);

        c.destroy();
      },
    );
  });

  describe('authenticated responses', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [
        withQueryPersistence({ adapter: () => store.adapter, filter: ({ url }) => !url.includes('/auth/') }),
      ],
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
});
