import { HttpHeaders } from '@angular/common/http';
import { DestroyRef, signal } from '@angular/core';
import { MAX_UNUSED_ENTRIES, withArgs, withResponseUpdate } from '../index';
import { describe, expect, it } from 'vitest';
import { sequence } from './harness/fake-api';
import { useScenario } from './harness';

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
});
