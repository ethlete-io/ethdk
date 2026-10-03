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
});
