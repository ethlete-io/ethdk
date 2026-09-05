import { HttpErrorResponse, HttpEventType, HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import { createQueryClient, withArgs, withLogging, withLongPolling } from '../index';
import { beforeEach, describe, expect, it } from 'vitest';
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

  it('names the injection token after the client so two clients never collide', () => {
    const s = scenario();

    const alphaRef = createQueryClient({ name: 'alpha', baseUrl: 'https://alpha.test' });
    const betaRef = createQueryClient({ name: 'beta', baseUrl: 'https://beta.test' });

    expect(String(alphaRef.token)).toContain('QueryClient_alpha');
    expect(String(betaRef.token)).toContain('QueryClient_beta');

    const alpha = s.run(() => alphaRef.inject());
    const beta = s.run(() => betaRef.inject());

    expect(alpha).not.toBe(beta);
    expect(alpha.baseUrl).toBe('https://alpha.test');
    expect(beta.baseUrl).toBe('https://beta.test');
  });

  it('shares one cache entry between two queries with the same custom key', () => {
    const s = scenario();
    s.api.on('GET', '/settings', () => ({ body: { theme: 'dark' } }));

    const getSettings = s.get<{ response: { theme: string } }>('/settings');

    const a = s.consumer();
    const b = s.consumer();
    const first = a.run(() => getSettings({ key: 'shared' }));
    const second = b.run(() => getSettings({ key: 'shared' }));

    s.tick();

    expect(s.api.requestCount('GET', '/settings')).toBe(1);
    expect(first.id()).toBe(second.id());
    expect(s.client.repository.subtle.cacheEntries().length).toBe(1);

    const c = s.consumer();
    const other = c.run(() => getSettings({ key: 'other' }));

    s.tick();

    expect(other.id()).not.toBe(first.id());
    expect(s.client.repository.subtle.cacheEntries().length).toBe(2);

    a.destroy();
    b.destroy();
    c.destroy();
  });

  it('sends nothing for an onlyManualExecution GET until execute() is called', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const c = s.consumer();
    const query = c.run(() =>
      getUser(
        { onlyManualExecution: true },
        withArgs(() => ({ pathParams: { id: '1' } })),
      ),
    );

    s.tick();

    expect(s.api.requestCount('GET', '/users/1')).toBe(0);

    query.execute();
    s.tick();

    expect(s.api.requestCount('GET', '/users/1')).toBe(1);
    expect(query.response()).toEqual({ id: '1' });

    c.destroy();
  });

  it('throws for a function route without withArgs, and accepts execute() args once silenced', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const c = s.consumer();

    expect(() => c.run(() => getUser())).toThrow(/ET100|withArgs/);

    const query = c.run(() => getUser({ silenceMissingWithArgsFeatureError: true }));

    s.tick();

    expect(s.api.requests.length).toBe(0);

    query.execute({ args: { pathParams: { id: '7' } } });
    s.tick();

    expect(s.api.requestCount('GET', '/users/7')).toBe(1);
    expect(query.response()).toEqual({ id: '7' });

    c.destroy();
  });

  it('binds a query to the injector its config names, not the calling context', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const owner = s.consumer();
    const query = s.run(() =>
      getUser(
        { injector: owner.injector },
        withArgs(() => ({ pathParams: { id: '1' } })),
      ),
    );

    s.tick();

    expect(query.response()).toEqual({ id: '1' });
    expect(s.client.repository.subtle.cacheEntries().length).toBe(1);

    owner.destroy();

    expect(s.client.repository.subtle.cacheEntries().length).toBe(0);
  });

  it('clones a creator with a merged retryFn and leaves the original creator alone', () => {
    const s = scenario();
    s.api.on('GET', '/flaky', () => ({ status: 400, body: { message: 'nope' } }));

    const strict = s.get<{ response: unknown; queryParams: { v: string } }>('/flaky', {
      retryFn: () => ({ retry: false }),
    });
    const retrying = strict.clone({
      retryFn: ({ retryCount }) => (retryCount === 1 ? { retry: true, delay: 100 } : { retry: false }),
    });

    const a = s.consumer();
    const b = s.consumer();
    a.run(() => retrying(withArgs(() => ({ queryParams: { v: 'clone' } }))));
    b.run(() => strict(withArgs(() => ({ queryParams: { v: 'original' } }))));

    s.flush();

    expect(s.api.requests.filter((r) => r.query['v'] === 'clone').length).toBe(2);
    expect(s.api.requests.filter((r) => r.query['v'] === 'original').length).toBe(1);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);

    a.destroy();
    b.destroy();
  });

  it('keeps the last good response on the query itself when a re-execution fails', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/report',
      sequence([{ body: { v: 1 } }, { status: 400, body: { message: 'nope' } }, { body: { v: 3 } }]),
    );

    const getReport = s.get<{ response: { v: number } }>('/report');

    const c = s.consumer();
    const query = c.run(() => getReport());

    s.tick();
    expect(query.response()).toEqual({ v: 1 });

    query.execute();
    s.tick();

    expect(query.error()?.code).toBe(400);
    expect(query.response()).toEqual({ v: 1 });

    query.execute();
    s.tick();

    expect(query.error()).toBeNull();
    expect(query.response()).toEqual({ v: 3 });

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('reports speed and remaining time alongside the percentage while a body downloads', () => {
    const s = scenario();
    s.api.on('GET', '/file', () => ({ body: { ok: true }, delay: 3000, progress: [40] }));

    const getFile = s.get<{ response: { ok: boolean } }>('/file', { reportProgress: true });

    const seen: { percentage: number; speed: number | null; remainingTime: number | null }[] = [];
    const c = s.consumer();
    const query = c.run(() => {
      const q = getFile(
        withLogging({
          logFn: (event) => {
            if (event?.type !== HttpEventType.DownloadProgress) return;

            const progress = q.loading()?.progress;

            if (progress) seen.push(progress);
          },
        }),
      );

      return q;
    });

    s.tick(3000);

    expect(seen.length).toBe(1);
    expect(seen[0]?.percentage).toBe(40);
    expect(seen[0]?.speed).toBeCloseTo(13.333, 2);
    expect(seen[0]?.remainingTime).toBe(4500);
    expect(query.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('stamps lastTimeExecutedAt with the fake clock on every execution', () => {
    const s = scenario();
    s.api.on('GET', '/ping', () => ({ body: { ok: true } }));

    const getPing = s.get<{ response: { ok: boolean } }>('/ping');

    const startedAt = Date.now();
    const c = s.consumer();
    const query = c.run(() => getPing());

    s.tick();
    expect(query.lastTimeExecutedAt()).toBe(startedAt);

    s.tick(5000);
    query.execute();
    s.tick();

    expect(query.lastTimeExecutedAt()).toBe(startedAt + 5000);

    c.destroy();
  });

  it('reports triggeredBy for a long-polled round and null for a hand-rolled execute()', () => {
    const s = scenario();
    let cursor = 0;

    s.api.on('GET', '/events', () => {
      cursor++;

      return { body: { cursor }, delay: 50 };
    });

    const getEvents = s.get<{ response: { cursor: number }; queryParams: { cursor: number | null } }>('/events');

    const c = s.consumer();
    const query = c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        withLongPolling({ nextArgs: (response) => (response ? { queryParams: { cursor: response.cursor } } : null) }),
      ),
    );

    s.tick(50);
    expect(query.response()).toEqual({ cursor: 1 });
    expect(query.triggeredBy()).toBeNull();

    s.tick(250);
    expect(query.triggeredBy()).toBe('long-polling');

    s.tick(50);
    expect(query.response()).toEqual({ cursor: 2 });

    query.execute();
    s.tick(50);

    expect(query.triggeredBy()).toBeNull();

    c.destroy();
  });

  it('tags a run with the triggeredBy the caller passed', () => {
    const s = scenario();
    s.api.on('POST', '/users', ({ body }) => ({ status: 201, body }));

    const createUser = s.post<{ body: { name: string }; response: { name: string } }>('/users');

    const c = s.consumer();
    const mutation = c.run(() => createUser());

    mutation.execute({ args: { body: { name: 'Ada' } }, options: { triggeredBy: 'save-button' } });
    s.tick();

    expect(mutation.triggeredBy()).toBe('save-button');
    expect(mutation.response()).toEqual({ name: 'Ada' });

    c.destroy();
  });

  it('freezes a snapshot against a later execution and flips isAlive once its execution settled', () => {
    const s = scenario();
    s.api.on('GET', '/thing', sequence([{ body: { v: 1 }, delay: 100 }, { body: { v: 2 } }]));

    const getThing = s.get<{ response: { v: number } }>('/thing');

    const c = s.consumer();
    const query = c.run(() => getThing());
    const snapshot = c.run(() => query.createSnapshot());

    s.tick();

    expect(snapshot.isAlive()).toBe(true);
    expect(snapshot.loading()).not.toBeNull();
    expect(snapshot.response()).toBeNull();

    s.tick(100);

    expect(snapshot.response()).toEqual({ v: 1 });
    expect(snapshot.isAlive()).toBe(false);

    query.execute();
    s.tick();

    expect(query.response()).toEqual({ v: 2 });
    expect(snapshot.response()).toEqual({ v: 1 });

    c.destroy();
  });

  it('strips execute(), reset() and subtle from an asReadonly() view', () => {
    const s = scenario();
    s.api.on('GET', '/ping', () => ({ body: { ok: true } }));

    const getPing = s.get<{ response: { ok: boolean } }>('/ping');

    const c = s.consumer();
    const query = c.run(() => getPing());

    s.tick();

    const readonlyQuery = query.asReadonly();

    expect('execute' in readonlyQuery).toBe(false);
    expect('reset' in readonlyQuery).toBe(false);
    expect('subtle' in readonlyQuery).toBe(false);
    expect('asReadonly' in readonlyQuery).toBe(false);
    expect(readonlyQuery.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('reports the kept response on the failure execution state when a refresh errors', () => {
    const s = scenario();
    s.api.on('GET', '/stats', sequence([{ body: { v: 1 } }, { status: 400, body: { message: 'nope' } }]));

    const getStats = s.get<{ response: { v: number } }>('/stats');

    const c = s.consumer();
    const query = c.run(() => getStats());

    s.tick();
    expect(query.executionState()).toEqual({ type: 'success', response: { v: 1 } });

    query.execute();
    s.tick();

    expect(query.executionState()).toMatchObject({
      type: 'failure',
      hasCachedResponse: true,
      cachedResponse: { v: 1 },
    });

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });
});

describe('queries scenario: client defaults', () => {
  const scenario = useScenario();

  it('keeps an unused entry for five minutes when nothing configures keepUnusedFor', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const c = s.consumer();
    c.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));

    s.tick();
    expect(s.client.repository.subtle.cacheEntries().length).toBe(1);

    c.destroy();
    expect(s.client.repository.subtle.cacheEntries().length).toBe(1);

    s.tick(299_999);
    expect(s.client.repository.subtle.cacheEntries().length).toBe(1);

    s.tick(1);
    expect(s.client.repository.subtle.cacheEntries().length).toBe(0);
  });
});

describe('queries scenario: query string config', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0, queryString: { objectNotation: 'dot', writeArrayIndexes: true } },
  });

  it('serializes query params the way the client queryString config asks for', () => {
    const s = scenario();
    s.api.on('GET', '/search', () => ({ body: [] }));

    const search = s.get<{ response: unknown[]; queryParams: { filter: { status: string }; tags: string[] } }>(
      '/search',
    );

    const c = s.consumer();
    c.run(() => search(withArgs(() => ({ queryParams: { filter: { status: 'active' }, tags: ['a', 'b'] } }))));

    s.tick();

    expect(s.api.requests[0]?.query).toEqual({ 'filter.status': 'active', 'tags[0]': 'a', 'tags[1]': 'b' });

    c.destroy();
  });
});

describe('queries scenario: client headers', () => {
  const previewToken = signal('a');
  const scenario = useScenario({
    clientOptions: {
      keepUnusedFor: 0,
      headers: () => new HttpHeaders({ 'X-Preview-Token': previewToken(), 'X-Tenant': 'acme' }),
    },
  });

  beforeEach(() => previewToken.set('a'));

  it('merges per-execution headers over the client-wide ones, name by name', () => {
    const s = scenario();
    s.api.on('GET', '/me', () => ({ body: { ok: true } }));

    const getMe = s.get<{ response: { ok: boolean }; headers: HttpHeaders }>('/me');

    const c = s.consumer();
    c.run(() =>
      getMe(
        withArgs(() => ({
          headers: new HttpHeaders({ 'X-Preview-Token': 'from-args', 'X-Request-Id': 'r1' }),
        })),
      ),
    );

    s.tick();

    const sent = s.api.requests[0]?.headers;

    expect(sent?.get('X-Preview-Token')).toBe('from-args');
    expect(sent?.get('X-Tenant')).toBe('acme');
    expect(sent?.get('X-Request-Id')).toBe('r1');

    c.destroy();
  });

  it('shares one cache entry across a client-header change instead of churning the cache', () => {
    const s = scenario();
    s.api.on('GET', '/me', ({ headers }) => ({ body: { token: headers.get('X-Preview-Token') } }));

    const getMe = s.get<{ response: { token: string | null } }>('/me');

    const a = s.consumer();
    const first = a.run(() => getMe());

    s.tick();
    expect(first.response()).toEqual({ token: 'a' });

    previewToken.set('b');

    const b = s.consumer();
    const second = b.run(() => getMe());

    s.tick();

    expect(second.id()).toBe(first.id());
    expect(s.client.repository.subtle.cacheEntries().length).toBe(1);

    a.destroy();
    b.destroy();
  });

  it('leaves resolved queries on the old header value until refreshQueriesInUse() is called', () => {
    const s = scenario();
    s.api.on('GET', '/me', ({ headers }) => ({ body: { token: headers.get('X-Preview-Token') } }));

    const getMe = s.get<{ response: { token: string | null } }>('/me');

    const c = s.consumer();
    const query = c.run(() => getMe());

    s.tick();
    expect(query.response()).toEqual({ token: 'a' });

    previewToken.set('b');
    s.tick();

    expect(s.api.requestCount('GET', '/me')).toBe(1);
    expect(query.response()).toEqual({ token: 'a' });

    s.client.refreshQueriesInUse();
    s.tick();

    expect(s.api.requestCount('GET', '/me')).toBe(2);
    expect(query.response()).toEqual({ token: 'b' });

    c.destroy();
  });
});
