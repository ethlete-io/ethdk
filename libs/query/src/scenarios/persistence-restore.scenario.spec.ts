import { createFakeQueryPersistenceStore, FakeQueryPersistenceStoreHandle } from '@ethlete/query/testing';
import { createGetQuery, createQueryClient, withQueryPersistence } from '../index';
import { beforeEach, describe, expect, it } from 'vitest';
import { sequence, useScenario } from './harness';

let store: FakeQueryPersistenceStoreHandle;

describe('persistence restore scenario', () => {
  beforeEach(() => {
    store = createFakeQueryPersistenceStore();
  });

  describe('a stale entry', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter, version: 1 })],
    });

    it('renders an entry whose freshness window ended, revalidates it, and writes the new body with a new window', async () => {
      const s = scenario();
      s.api.on(
        'GET',
        '/standings',
        sequence([
          { body: { leader: 'a' }, headers: { 'cache-control': 'max-age=20' } },
          { body: { leader: 'b' }, headers: { 'cache-control': 'max-age=20' }, delay: 100 },
        ]),
      );

      const getStandings = s.get<{ response: { leader: string } }>('/standings');

      const first = s.consumer();
      const firstQuery = first.run(() => getStandings());
      s.tick();
      const key = firstQuery.id();
      if (!key) throw new Error('expected a repository key');
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      const firstExpiresAt = store.entry(key)?.expiresAt;
      expect(firstExpiresAt).toBeTypeOf('number');

      s.tick(60_000);
      expect(Date.now()).toBeGreaterThan(firstExpiresAt as number);

      const second = s.consumer();
      const query = second.run(() => getStandings());
      await s.settle(0);

      expect(query.response()).toEqual({ leader: 'a' });
      expect(query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: true });
      expect(s.api.requestCount('GET', '/standings')).toBe(2);

      s.tick(100);
      expect(query.response()).toEqual({ leader: 'b' });
      expect(query.executionState()).toMatchObject({ type: 'success' });

      await s.client.subtle.persistence?.flush();
      await s.settle();

      expect(store.entry(key)?.body).toEqual({ leader: 'b' });
      expect(store.entry(key)?.expiresAt).toBeGreaterThan(Date.now());

      second.destroy();
    });

    it('does not let an allowCache execute serve a hydrated entry whose freshness window ended', async () => {
      const s = scenario();
      s.api.on(
        'GET',
        '/fixtures',
        sequence([
          { body: { round: 1 }, headers: { 'cache-control': 'max-age=20' } },
          { body: { round: 2 }, headers: { 'cache-control': 'max-age=20' } },
          { body: { round: 3 } },
        ]),
      );

      const getFixtures = s.get<{ response: { round: number } }>('/fixtures');

      const first = s.consumer();
      const firstQuery = first.run(() => getFixtures({ onlyManualExecution: true }));
      firstQuery.execute();
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();

      s.tick(60_000);

      const second = s.consumer();
      const query = second.run(() => getFixtures({ onlyManualExecution: true }));
      await s.settle(0);
      s.tick();

      query.execute({ options: { allowCache: true } });
      s.tick();

      expect(s.api.requestCount('GET', '/fixtures')).toBe(2);
      expect(query.response()).toEqual({ round: 2 });

      second.destroy();
    });
  });

  describe('a response schema change behind a version bump', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: () => store.adapter, version: 1 })],
    });

    it('never shows the old shape, not even while the new build loads, and overwrites the entry with the new shape under its own version', async () => {
      const s = scenario();
      s.api.once('GET', '/profile', () => ({ body: { name: 'Ada Lovelace' } }));
      s.api.on('GET', '/profile', () => ({ body: { firstName: 'Ada', lastName: 'Lovelace' }, delay: 100 }));

      const first = s.consumer();
      first.run(() => s.get<{ response: { name: string } }>('/profile')());
      s.tick();
      await s.client.subtle.persistence?.flush();
      await s.settle();
      first.destroy();
      expect(store.entries().map((e) => [e.version, e.body])).toEqual([[1, { name: 'Ada Lovelace' }]]);

      const nextBuildRef = createQueryClient({
        name: 'persistence-restore-next-build',
        baseUrl: 'https://api.test',
        keepUnusedFor: 0,
        features: [withQueryPersistence({ adapter: store.adapter, version: 2 })],
      });
      const nextBuild = s.run(() => nextBuildRef.inject());
      if (!nextBuild) throw new Error('expected the next build client to be created');
      await nextBuild.whenPersistenceReady;

      const getProfile = createGetQuery(nextBuildRef)<{ response: { firstName: string; lastName: string } }>(
        '/profile',
      );
      const second = s.consumer();
      const query = second.run(() => getProfile());
      await s.settle(0);
      s.tick();

      expect(query.response()).toBeNull();
      expect(query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: false });

      s.tick(100);
      expect(query.response()).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });

      await nextBuild.subtle.persistence?.flush();
      await s.settle();

      expect(store.entries().map((e) => [e.version, e.body])).toEqual([
        [2, { firstName: 'Ada', lastName: 'Lovelace' }],
      ]);

      second.destroy();
    });
  });
});
