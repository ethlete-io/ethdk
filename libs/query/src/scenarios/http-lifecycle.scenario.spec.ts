import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import {
  createPagedQueryStack,
  createQueryBatch,
  executeUntilSettled,
  withArgs,
  withLogging,
  withLongPolling,
  withPolling,
  withSuccessHandling,
} from '../index';
import { ObservedValueOf } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

describe('http lifecycle scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('a reset query stays in the never-executed state while another consumer re-runs the shared request', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const a = s.consumer();
    const b = s.consumer();
    const successes: unknown[] = [];
    const qa = a.run(() =>
      getUser(
        withArgs(() => ({ pathParams: { id: '1' } })),
        withSuccessHandling({ handler: (r) => successes.push(r) }),
      ),
    );
    const qb = b.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));

    s.tick();
    expect(qa.response()).toEqual({ id: '1' });
    expect(successes.length).toBe(1);

    qa.reset();

    expect(qa.response()).toBeNull();
    expect(qa.executionState()).toBeNull();
    expect(qa.id()).toBeNull();

    qb.execute();

    expect(qa.loading()).toBeNull();
    expect(qa.executionState()).toBeNull();

    s.tick();

    expect(qb.response()).toEqual({ id: '1' });
    expect(qa.response()).toBeNull();
    expect(qa.executionState()).toBeNull();
    expect(successes.length).toBe(1);

    a.destroy();
    b.destroy();
  });

  it('rapid legitimate args changes re-execute without tripping the circular-dependency guard', () => {
    const s = scenario();
    s.api.on('GET', '/search', ({ query }) => ({ body: { q: query['q'] } }));

    const search = s.get<{ response: { q: string }; queryParams: { q: string } }>('/search');
    const term = signal('a');

    const c = s.consumer();
    const query = c.run(() => search(withArgs(() => ({ queryParams: { q: term() } }))));

    s.tick();

    for (const next of ['ab', 'abc', 'abcd', 'abcde', 'abcdef', 'abcdefg', 'abcdefgh']) {
      term.set(next);
      s.tick(10);
    }

    expect(query.response()).toEqual({ q: 'abcdefgh' });

    c.destroy();
  });

  it('the same query executed with identical args six times in a row within 100 ms throws ET800', () => {
    const s = scenario();
    s.api.on('GET', '/loop', () => ({ body: { ok: true } }));

    const getLoop = s.get<{ response: { ok: boolean } }>('/loop');

    const c = s.consumer();
    const query = c.run(() => getLoop());

    expect(() => {
      for (let i = 0; i < 4; i++) query.execute();
    }).not.toThrow();
    expect(() => query.execute()).toThrow(/circular dependency/);

    s.tick();
    expect(query.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('a response with max-age=0 is stale immediately, so an allowCache execute re-fetches', () => {
    const s = scenario();
    let n = 0;
    s.api.on('GET', '/now', () => ({ body: { n: ++n }, headers: { 'cache-control': 'max-age=0' } }));

    const getNow = s.get<{ response: { n: number } }>('/now');

    const c = s.consumer();
    const query = c.run(() => getNow());

    s.tick();
    expect(query.response()).toEqual({ n: 1 });

    query.execute({ options: { allowCache: true } });
    s.tick();

    expect(s.api.requestCount('GET', '/now')).toBe(2);
    expect(query.response()).toEqual({ n: 2 });

    c.destroy();
  });

  it('with blockExecutionDuringLoading a paged stack can fetch the next page after having fetched a previous one', () => {
    const s = scenario();
    s.api.on('GET', '/posts', ({ query }) => ({
      body: { items: [{ id: Number(query['page']) }], currentPage: Number(query['page']), totalPages: 5 },
    }));

    const getPosts = s.get<{
      response: { items: { id: number }[]; currentPage: number; totalPages: number };
      queryParams: { page: number };
    }>('/posts');

    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPosts,
        responseNormalizer: (response) => ({
          items: response.items,
          totalPages: response.totalPages,
          currentPage: response.currentPage,
          itemsPerPage: 1,
          totalHits: response.totalPages,
        }),
        args: (page) => ({ queryParams: { page } }),
        initialPage: 3,
        blockExecutionDuringLoading: true,
      }),
    );

    s.tick();
    expect(pages.items()).toEqual([{ id: 3 }]);

    pages.fetchPreviousPage();
    s.tick();
    expect(pages.items()).toEqual([{ id: 2 }, { id: 3 }]);

    expect(pages.canFetchNextPage()).toBe(true);
    expect(pages.fetchNextPage()).not.toBeNull();
    s.tick();
    expect(pages.items()).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }]);

    expect(pages.canFetchPreviousPage()).toBe(true);
    expect(pages.fetchPreviousPage()).not.toBeNull();
    s.tick();
    expect(pages.items()).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);

    c.destroy();
  });

  it('unsubscribing from a batch run aborts its in-flight requests, cancel() lets them settle', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const patchPost = s.patch<{ response: { id: string }; pathParams: { id: string } }>((p) => `/posts/${p.id}`);

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPost,
        args: (item: { id: string }) => ({ pathParams: { id: item.id } }),
        concurrency: 2,
      }),
    );

    const sub = batch.run([{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]).subscribe();
    s.tick();
    expect(s.api.pending().length).toBe(2);

    sub.unsubscribe();
    expect(s.api.pending().length).toBe(0);
    expect(batch.running()).toBe(false);

    let result: ObservedValueOf<ReturnType<typeof batch.run>> | undefined;
    batch.run([{ id: '5' }, { id: '6' }, { id: '7' }, { id: '8' }]).subscribe((r) => (result = r));
    s.tick();
    expect(s.api.pending().length).toBe(2);

    batch.cancel();
    expect(s.api.pending().length).toBe(2);

    s.tick(100);

    expect(result?.cancelled).toBe(true);
    expect(result?.succeeded.map((r) => r.item.id)).toEqual(['5', '6']);
    expect(result?.notAttempted.map((r) => r.item.id)).toEqual(['7', '8']);
    expect(s.api.requestCount('PATCH', '/posts/7')).toBe(0);

    c.destroy();
  });

  it('executeUntilSettled resolves with the outcome of the execution it started, not a later one', async () => {
    const s = scenario();
    s.api.on('POST', '/things', ({ body }) => ({ body: { got: body }, delay: 50 }));

    const createThing = s.post<{ response: { got: unknown }; body: { n: number } }>('/things');

    const c = s.consumer();
    const query = c.run(() => createThing());

    let snapshot:
      Awaited<ReturnType<typeof executeUntilSettled<{ response: { got: unknown }; body: { n: number } }>>> | undefined;
    executeUntilSettled(query, { args: { body: { n: 1 } } }).then((snap) => (snapshot = snap));

    await s.settle(50);
    expect(snapshot?.response()).toEqual({ got: { n: 1 } });

    query.execute({ args: { body: { n: 2 } } });
    await s.settle(50);

    expect(snapshot?.response()).toEqual({ got: { n: 1 } });
    expect(query.response()).toEqual({ got: { n: 2 } });

    c.destroy();
  });
});

const tenant = signal('a');

describe('http lifecycle scenario: client headers', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0, headers: () => new HttpHeaders({ 'X-Tenant': tenant() }) },
  });

  it('client headers given as a function are re-read on every execution', () => {
    const s = scenario();
    s.api.on('GET', '/me', ({ headers }) => ({ body: { tenant: headers.get('X-Tenant') } }));

    const getMe = s.get<{ response: { tenant: string } }>('/me');

    const c = s.consumer();
    const query = c.run(() => getMe());

    s.tick();
    expect(query.response()).toEqual({ tenant: 'a' });

    tenant.set('b');
    query.execute();
    s.tick();
    expect(query.response()).toEqual({ tenant: 'b' });

    c.destroy();
  });
});

describe('http lifecycle scenario: probes', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('withPolling skips a tick while the previous round is in flight and keeps polling afterwards', () => {
    const s = scenario();
    s.api.on('GET', '/slow', () => ({ body: { ok: true }, delay: 250 }));

    const getSlow = s.get<{ response: { ok: boolean } }>('/slow');

    const c = s.consumer();
    c.run(() => getSlow(withPolling({ interval: 100 })));

    s.tick();
    expect(s.api.requestCount('GET', '/slow')).toBe(1);

    s.tick(100);
    expect(s.api.requestCount('GET', '/slow')).toBe(1);
    s.tick(100);
    expect(s.api.requestCount('GET', '/slow')).toBe(1);
    s.tick(100);
    expect(s.api.requestCount('GET', '/slow')).toBe(2);
    s.tick(300);
    expect(s.api.requestCount('GET', '/slow')).toBe(3);

    c.destroy();
  });

  it('withPolling pauses while args are parked and resumes once they are set again', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);
    const id = signal<string | null>('1');

    const c = s.consumer();
    c.run(() =>
      getUser(
        withArgs(() => (id() ? { pathParams: { id: id() as string } } : null)),
        withPolling({ interval: 100 }),
      ),
    );

    s.tick();
    expect(s.api.requestCount('GET', '/users/1')).toBe(1);
    s.tick(100);
    expect(s.api.requestCount('GET', '/users/1')).toBe(2);

    id.set(null);
    s.tick(500);
    expect(s.api.requestCount('GET', '/users/1')).toBe(2);

    id.set('2');
    s.tick();
    expect(s.api.requestCount('GET', '/users/2')).toBe(1);
    s.tick(100);
    expect(s.api.requestCount('GET', '/users/2')).toBe(2);

    c.destroy();
  });

  it('reportProgress surfaces download progress on loading()', () => {
    const s = scenario();
    s.api.on('GET', '/file', () => ({ body: { ok: true }, progress: [25, 50] }));

    const getFile = s.get<{ response: { ok: boolean } }>('/file', { reportProgress: true });

    const seen: (number | undefined)[] = [];
    const c = s.consumer();
    const query = c.run(() => {
      const q = getFile(withLogging({ logFn: () => seen.push(q.loading()?.progress?.percentage) }));

      return q;
    });

    s.tick();

    expect(seen).toEqual([25, 50, undefined]);
    expect(query.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('a 204 settles as a success with a null response', () => {
    const s = scenario();
    s.api.on('GET', '/empty', () => ({ status: 204 }));

    const getEmpty = s.get<{ response: null }>('/empty');

    const c = s.consumer();
    let handled = 0;
    const query = c.run(() => getEmpty(withSuccessHandling({ handler: () => handled++ })));

    s.tick();

    expect(query.executionState()?.type).toBe('success');
    expect(query.response()).toBeNull();
    expect(handled).toBe(1);

    c.destroy();
  });
});

describe('http lifecycle scenario: retention', () => {
  const scenario = useScenario();

  it('long polling rounds are not retained after the chain moves on', () => {
    const s = scenario();
    s.api.on('GET', '/events', ({ query }) => ({ body: { cursor: Number(query['cursor'] ?? 0) + 1 } }));

    const getEvents = s.get<{ response: { cursor: number }; queryParams: { cursor: number } }>('/events');

    const c = s.consumer();
    c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: 0 } })),
        withLongPolling({
          nextArgs: (response) =>
            response && response.cursor < 3 ? { queryParams: { cursor: response.cursor } } : null,
        }),
      ),
    );

    s.tick();
    expect(s.api.requestCount('GET', '/events')).toBe(1);

    s.tick(300);
    expect(s.api.requestCount('GET', '/events')).toBe(2);
    expect(s.client.repository.subtle.cacheEntries().length).toBe(1);

    s.tick(300);
    expect(s.api.requestCount('GET', '/events')).toBe(3);
    expect(s.client.repository.subtle.cacheEntries().length).toBe(1);

    c.destroy();
    expect(s.client.repository.subtle.cacheEntries().length).toBe(0);
  });

  it('a consumer returning inside keepUnusedFor to an entry whose revalidation failed sees the old data and a fresh request', () => {
    const s = scenario();
    let fail = false;
    s.api.on('GET', '/data', () => (fail ? { status: 500, body: { message: 'boom' } } : { body: { v: 1 } }));

    const getData = s.get<{ response: { v: number } }>('/data');

    const a = s.consumer();
    const qa = a.run(() => getData());
    s.tick();
    expect(qa.response()).toEqual({ v: 1 });

    fail = true;
    qa.execute();
    s.tick();
    expect(qa.error()?.code).toBe(500);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);

    a.destroy();
    fail = false;

    const b = s.consumer();
    const qb = b.run(() => getData());

    const state = qb.executionState();
    expect(state?.type).toBe('loading');
    expect(state?.type === 'loading' && state.hasCachedResponse && state.cachedResponse).toEqual({ v: 1 });

    s.tick();
    expect(qb.response()).toEqual({ v: 1 });
    expect(qb.error()).toBeNull();

    b.destroy();
    s.tick(300_000);
  });
});
