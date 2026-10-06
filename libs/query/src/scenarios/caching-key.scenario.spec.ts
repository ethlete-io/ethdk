import { def, V2QueryClient, withArgs } from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

type Filter = { status: string; sort: { field: string; dir: string }; since?: Date };

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

  it('shares one cache entry between query params written in a different key order', () => {
    const s = scenario();
    s.api.on('GET', '/posts', () => ({ body: { items: ['a'] } }));

    const getPosts = s.get<{ response: { items: string[] }; queryParams: Filter }>('/posts');
    const since = new Date('2026-09-01T10:00:00.000Z');

    const a = s.consumer();
    const b = s.consumer();
    const first = a.run(() =>
      getPosts(withArgs(() => ({ queryParams: { status: 'open', sort: { field: 'date', dir: 'asc' }, since } }))),
    );
    const second = b.run(() =>
      getPosts(
        withArgs(() => ({
          queryParams: { since: new Date(since), sort: { dir: 'asc', field: 'date' }, status: 'open' },
        })),
      ),
    );

    s.tick();

    expect(first.id()).toBe(second.id());
    expect(s.api.requestCount('GET', '/posts')).toBe(1);
    expect(s.api.requests[0]?.url).toBe(
      'https://api.test/posts?status=open&sort%5Bfield%5D=date&sort%5Bdir%5D=asc&since=2026-09-01T10%3A00%3A00.000Z',
    );
    expect(second.response()).toEqual({ items: ['a'] });

    a.destroy();
    b.destroy();
  });

  it('keeps a Date query param that changes on a separate cache entry', () => {
    const s = scenario();
    s.api.on('GET', '/posts', () => ({ body: { items: [] } }));

    const getPosts = s.get<{ response: { items: string[] }; queryParams: Pick<Filter, 'since'> }>('/posts');

    const a = s.consumer();
    const b = s.consumer();
    const first = a.run(() => getPosts(withArgs(() => ({ queryParams: { since: new Date('2026-09-01T00:00:00Z') } }))));
    const second = b.run(() =>
      getPosts(withArgs(() => ({ queryParams: { since: new Date('2026-09-02T00:00:00Z') } }))),
    );

    s.tick();

    expect(first.id()).not.toBe(second.id());
    expect(s.api.requestCount('GET', '/posts')).toBe(2);

    a.destroy();
    b.destroy();
  });

  it('gives a legacy query the same store key for query params written in a different key order', () => {
    const s = scenario();
    const owner = s.consumer();
    const client = owner.run(() => new V2QueryClient({ baseRoute: 'https://api.test' }));
    const getPosts = client.get({
      route: '/posts',
      types: { args: def<{ queryParams: Filter }>(), response: def<{ items: string[] }>() },
    });
    const since = new Date('2026-09-01T10:00:00.000Z');

    const first = getPosts.prepare({ queryParams: { status: 'open', sort: { field: 'date', dir: 'asc' }, since } });
    const second = getPosts.prepare({
      queryParams: { since: new Date(since), sort: { dir: 'asc', field: 'date' }, status: 'open' },
    });
    const other = getPosts.prepare({
      queryParams: { status: 'open', sort: { field: 'date', dir: 'asc' }, since: new Date('2026-09-02T10:00:00Z') },
    });

    expect(second).toBe(first);
    expect(other).not.toBe(first);
    expect(first._routeWithParams).toBe(
      'https://api.test/posts?status=open&sort%5Bfield%5D=date&sort%5Bdir%5D=asc&since=2026-09-01T10%3A00%3A00.000Z',
    );

    client._store.forEach((_query, key) => client._store.remove(key));
    owner.destroy();
  });

  it('keeps creators with different wire or retry options apart and shares identical ones', () => {
    const s = scenario();
    s.api.on('GET', '/file', () => ({ body: { ok: true } }));

    const getJson = s.get<{ response: unknown }>('/file');
    const getJsonAgain = s.get<{ response: unknown }>('/file');
    const getBlob = s.get<{ response: unknown }>('/file', { responseType: 'blob' });
    const getSilent = s.get<{ response: unknown }>('/file', { reportErrors: false });
    const getRetrying = getJson.clone({ retryFn: () => ({ retry: false }) });
    const getPlainClone = getJson.clone({});

    const consumers = [getJson, getJsonAgain, getBlob, getSilent, getRetrying, getPlainClone].map((creator) => {
      const consumer = s.consumer();

      return { consumer, query: consumer.run(() => creator()) };
    });

    s.tick();

    const [json, jsonAgain, blob, silent, retrying, plainClone] = consumers.map((c) => c.query.id());

    expect(jsonAgain).toBe(json);
    expect(plainClone).toBe(json);
    expect(new Set([json, blob, silent, retrying]).size).toBe(4);

    consumers.forEach((c) => c.consumer.destroy());
  });
});
