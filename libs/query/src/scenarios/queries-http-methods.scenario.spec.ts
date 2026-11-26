import { withArgs } from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

describe('http method creators scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('auto-executes a HEAD query and resolves its path params into the route', () => {
    const s = scenario();
    s.api.on('HEAD', '/assets/:id', () => ({ headers: { 'content-length': '512' } }));

    const headAsset = s.head<{ response: null; pathParams: { id: string } }>((p) => `/assets/${p.id}`);

    const c = s.consumer();
    const query = c.run(() => headAsset(withArgs(() => ({ pathParams: { id: 'poster' } }))));

    s.tick();

    expect(s.api.requestCount('HEAD', '/assets/poster')).toBe(1);
    expect(s.api.requests[0]?.method).toBe('HEAD');
    expect(query.executionState()?.type).toBe('success');
    expect(query.error()).toBeNull();

    c.destroy();
  });

  it('auto-executes an OPTIONS query and resolves its query params into the route', () => {
    const s = scenario();
    s.api.on('OPTIONS', '/uploads', ({ query }) => ({ body: { allow: ['POST'], folder: query['folder'] } }));

    const optionsUploads = s.options<{
      response: { allow: string[]; folder: string };
      queryParams: { folder: string };
    }>('/uploads');

    const c = s.consumer();
    const query = c.run(() => optionsUploads(withArgs(() => ({ queryParams: { folder: 'avatars' } }))));

    s.tick();

    expect(s.api.requests[0]?.method).toBe('OPTIONS');
    expect(s.api.requests[0]?.query).toEqual({ folder: 'avatars' });
    expect(query.response()).toEqual({ allow: ['POST'], folder: 'avatars' });

    c.destroy();
  });

  it('shares one cache entry between two consumers of the same HEAD route', () => {
    const s = scenario();
    s.api.on('HEAD', '/assets/:id', () => ({ headers: { 'content-length': '512' } }));

    const headAsset = s.head<{ response: null; pathParams: { id: string } }>((p) => `/assets/${p.id}`);

    const a = s.consumer();
    const b = s.consumer();
    const q1 = a.run(() => headAsset(withArgs(() => ({ pathParams: { id: 'poster' } }))));
    const q2 = b.run(() => headAsset(withArgs(() => ({ pathParams: { id: 'poster' } }))));

    s.tick();

    expect(s.api.requestCount('HEAD', '/assets/poster')).toBe(1);
    expect(q1.id()).toBe(q2.id());
    expect(q1.executionState()?.type).toBe('success');
    expect(q2.executionState()?.type).toBe('success');

    a.destroy();
    b.destroy();
  });

  it('shares one cache entry between two consumers of the same OPTIONS route', () => {
    const s = scenario();
    s.api.on('OPTIONS', '/uploads', () => ({ body: { allow: ['POST'] } }));

    const optionsUploads = s.options<{ response: { allow: string[] } }>('/uploads');

    const a = s.consumer();
    const b = s.consumer();
    const q1 = a.run(() => optionsUploads());
    const q2 = b.run(() => optionsUploads());

    s.tick();

    expect(s.api.requestCount('OPTIONS', '/uploads')).toBe(1);
    expect(q1.id()).toBe(q2.id());
    expect(q1.response()).toEqual(q2.response());

    a.destroy();
    b.destroy();
  });

  it('re-runs bound HEAD and OPTIONS queries on refreshQueriesInUse', () => {
    const s = scenario();
    s.api.on('HEAD', '/assets/:id', () => ({ headers: { 'content-length': '512' } }));
    s.api.on('OPTIONS', '/uploads', () => ({ body: { allow: ['POST'] } }));

    const headAsset = s.head<{ response: null; pathParams: { id: string } }>((p) => `/assets/${p.id}`);
    const optionsUploads = s.options<{ response: { allow: string[] } }>('/uploads');

    const a = s.consumer();
    a.run(() => headAsset(withArgs(() => ({ pathParams: { id: 'poster' } }))));

    const b = s.consumer();
    b.run(() => optionsUploads());

    s.tick();

    s.client.refreshQueriesInUse();
    s.tick();

    expect(s.api.requestCount('HEAD', '/assets/poster')).toBe(2);
    expect(s.api.requestCount('OPTIONS', '/uploads')).toBe(2);

    a.destroy();
    b.destroy();
  });
});
