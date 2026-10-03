import { createQueryBatch } from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

describe('http scan 2026-10-03 scenario', () => {
  describe('a cache-control with both max-age and s-maxage', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('takes the freshness window from max-age, whichever comes first', () => {
      const s = scenario();
      s.api.on('GET', '/feed', () => ({
        body: { n: 1 },
        headers: { 'cache-control': 'public, s-maxage=600, max-age=20' },
      }));

      const getFeed = s.get<{ response: { n: number } }>('/feed');

      const c = s.consumer();
      const query = c.run(() => getFeed());
      s.tick();

      s.tick(9_000);
      query.execute({ options: { allowCache: true } });
      s.tick();
      expect(s.api.requestCount('GET', '/feed')).toBe(1);

      s.tick(1_001);
      query.execute({ options: { allowCache: true } });
      s.tick();
      expect(s.api.requestCount('GET', '/feed')).toBe(2);

      c.destroy();
    });
  });

  describe('a cacheAdapter that answers NaN', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0, cacheAdapter: (headers) => parseInt(headers.get('x-ttl') ?? '') },
    });

    it('treats the response as having no freshness window instead of fresh forever', () => {
      const s = scenario();
      s.api.on('GET', '/nan-ttl', () => ({ body: { n: 1 } }));

      const getNanTtl = s.get<{ response: { n: number } }>('/nan-ttl');

      const c = s.consumer();
      const query = c.run(() => getNanTtl());
      s.tick();

      s.tick(1_000);
      query.execute({ options: { allowCache: true } });
      s.tick();
      expect(s.api.requestCount('GET', '/nan-ttl')).toBe(2);

      c.destroy();
    });
  });

  describe('a query batch with concurrency NaN', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('falls back to the default concurrency instead of never sending a request', () => {
      const s = scenario();
      s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

      const patchPost = s.patch<{ response: { id: string }; pathParams: { id: string } }>((p) => `/posts/${p.id}`);

      const c = s.consumer();
      const batch = c.run(() =>
        createQueryBatch({
          queryCreator: patchPost,
          concurrency: Number('not a number'),
          args: (id: string) => ({ pathParams: { id } }),
        }),
      );

      let ok: boolean | undefined;
      batch.run(['1', '2', '3', '4', '5']).subscribe((result) => (ok = result.ok));
      s.tick();

      expect(s.api.pending().length).toBe(4);

      s.flush();

      expect(ok).toBe(true);
      expect(batch.status()).toBe('success');

      c.destroy();
    });
  });
});
