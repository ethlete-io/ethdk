import { HttpErrorResponse } from '@angular/common/http';
import { withArgs } from '../index';
import { describe, expect, it } from 'vitest';
import { sequence, useScenario } from './harness';

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

  it('never auto-executes a mutation and sends it only after execute()', () => {
    const s = scenario();
    s.api.on('POST', '/users', ({ body }) => ({ status: 201, body }));

    const createUser = s.post<{ body: { name: string }; response: { name: string } }>('/users');
    const c = s.consumer();
    const mutation = c.run(() => createUser());

    s.tick();
    expect(s.api.requestCount('POST', '/users')).toBe(0);

    mutation.execute({ args: { body: { name: 'Ada' } } });
    s.tick();

    expect(s.api.requestCount('POST', '/users')).toBe(1);
    expect(mutation.response()).toEqual({ name: 'Ada' });

    c.destroy();
  });

  it('rejects cache keys and allowCache on mutations', () => {
    const s = scenario();
    const createUser = s.post<{ body: { name: string }; response: unknown }>('/users');
    const c = s.consumer();
    const keyedMutation = c.run(() => createUser({ key: 'create-user' }));
    const mutation = c.run(() => createUser());

    expect(() => keyedMutation.execute({ args: { body: { name: 'Ada' } } })).toThrow(/ET300|cache key/);
    expect(() => mutation.execute({ args: { body: { name: 'Grace' } }, options: { allowCache: true } })).toThrow(
      /ET301|allowCache/,
    );
    expect(s.api.requestCount('POST', '/users')).toBe(0);

    c.destroy();
  });
  it('gives a snapshot its own id signal instead of taking over the query one', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const c = s.consumer();
    const query = c.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));

    s.tick();

    const snapshot = c.run(() => query.createSnapshot());

    expect(snapshot.id).not.toBe(query.id);

    const ids: unknown[] = [];
    const sub = query.id.asObservable().subscribe((id) => ids.push(id));

    s.tick();

    expect(ids).toEqual([query.id()]);

    sub.unsubscribe();
    c.destroy();
  });
  it('a snapshot of a failed query with a cached response reports the failure', () => {
    const s = scenario();
    s.api.on('GET', '/flaky', sequence([{ body: { data: { id: '1' } } }, { body: {} }]));

    const getFlaky = s.get<{ response: { id: string }; rawResponse: { data?: { id: string } } }>('/flaky', {
      transformResponse: (raw) => {
        if (!raw.data) throw new Error('unmappable response');

        return raw.data;
      },
    });

    const c = s.consumer();
    const query = c.run(() => getFlaky());

    s.tick();
    expect(query.response()).toEqual({ id: '1' });

    query.execute();
    s.tick();

    expect(query.error()?.code).toBe(0);
    expect(query.response()).toEqual({ id: '1' });

    const snapshot = c.run(() => query.createSnapshot());
    s.tick();

    expect(snapshot.error()?.code).toBe(0);
    expect(snapshot.executionState()?.type).toBe('failure');

    c.destroy();
  });
});
