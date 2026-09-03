import { HttpErrorResponse } from '@angular/common/http';
import { withArgs } from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

describe('queries scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('delivers response() for a GET with path params', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

    const getUser = s.get<{ response: { id: string; name: string }; pathParams: { id: string } }>(
      (p) => `/users/${p.id}`,
    );

    const c = s.consumer();
    const query = c.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));

    s.tick();

    expect(query.response()).toEqual({ id: '1', name: 'Ada' });

    c.destroy();
  });

  it('dedupes identical requests from two consumers into a single network call', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const a = s.consumer();
    const b = s.consumer();
    const q1 = a.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));
    const q2 = b.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));

    s.tick();

    expect(s.api.requestCount('GET', '/users/1')).toBe(1);
    expect(q1.response()).toEqual(q2.response());

    a.destroy();
    b.destroy();
  });

  it('sets error() and leaves response() null on a 500', () => {
    const s = scenario();
    s.api.on('GET', '/broken', () => ({ status: 500, body: { message: 'boom' } }));

    const getBroken = s.get<{ response: unknown }>('/broken');

    const c = s.consumer();
    const query = c.run(() => getBroken());

    s.tick();

    expect(query.response()).toBeNull();
    expect(query.error()?.code).toBe(500);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    c.destroy();
  });

  it('aborts the request when its consumer is destroyed before the response arrives', () => {
    const s = scenario();
    s.api.on('GET', '/slow', () => ({ body: [], delay: 500 }));

    const getSlow = s.get<{ response: unknown[] }>('/slow');

    const c = s.consumer();
    c.run(() => getSlow());

    expect(s.api.pending().length).toBe(1);

    c.destroy();

    expect(s.api.pending().length).toBe(0);
    expect(s.api.requests[0]?.aborted).toBe(true);
  });

  it('releases the cache entry once its last consumer is destroyed (keepUnusedFor: 0)', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const c = s.consumer();
    c.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));
    s.tick();

    expect(s.client.repository.subtle.cacheEntries().length).toBe(1);

    c.destroy();

    expect(s.client.repository.subtle.cacheEntries().length).toBe(0);
  });

  it('does not reveal a delayed response before its delay elapses', () => {
    const s = scenario();
    s.api.on('GET', '/slow', () => ({ body: { ready: true }, delay: 300 }));

    const getSlow = s.get<{ response: { ready: boolean } }>('/slow');

    const c = s.consumer();
    const query = c.run(() => getSlow());

    s.tick(299);
    expect(query.response()).toBeNull();

    s.tick(1);
    expect(query.response()).toEqual({ ready: true });

    c.destroy();
  });
});
