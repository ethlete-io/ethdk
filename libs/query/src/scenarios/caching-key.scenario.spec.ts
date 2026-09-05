import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

describe('cache key scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('does not let a HEAD and an OPTIONS query on one route share a cache entry', () => {
    const s = scenario();
    s.api.on('HEAD', '/uploads', () => ({ headers: { 'content-length': '512' } }));
    s.api.on('OPTIONS', '/uploads', () => ({ body: { allow: ['POST'] } }));

    const headUploads = s.head<{ response: null }>('/uploads');
    const optionsUploads = s.options<{ response: { allow: string[] } }>('/uploads');

    const a = s.consumer();
    const b = s.consumer();
    const headQuery = a.run(() => headUploads());
    const optionsQuery = b.run(() => optionsUploads());

    s.tick();

    expect(headQuery.id()).not.toBe(optionsQuery.id());
    expect(s.api.requestCount('HEAD', '/uploads')).toBe(1);
    expect(s.api.requestCount('OPTIONS', '/uploads')).toBe(1);
    expect(headQuery.response()).toBeNull();
    expect(optionsQuery.response()).toEqual({ allow: ['POST'] });

    a.destroy();
    b.destroy();
  });

  it('does not let a GET and a HEAD query on one route share a cache entry', () => {
    const s = scenario();
    s.api.on('GET', '/uploads', () => ({ body: { items: ['a'] } }));
    s.api.on('HEAD', '/uploads', () => ({ headers: { 'content-length': '512' } }));

    const getUploads = s.get<{ response: { items: string[] } }>('/uploads');
    const headUploads = s.head<{ response: null }>('/uploads');

    const a = s.consumer();
    const b = s.consumer();
    const getQuery = a.run(() => getUploads());
    const headQuery = b.run(() => headUploads());

    s.tick();

    expect(getQuery.id()).not.toBe(headQuery.id());
    expect(s.api.requestCount('GET', '/uploads')).toBe(1);
    expect(s.api.requestCount('HEAD', '/uploads')).toBe(1);
    expect(getQuery.response()).toEqual({ items: ['a'] });

    a.destroy();
    b.destroy();
  });
});
