import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { Paginated } from '@ethlete/types';
import {
  createPagedQueryStack,
  createQueryBatch,
  createQueryStack,
  ethletePaginationAdapter,
  querySequence,
} from '../index';
import { ObservedValueOf } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Scenario, useScenario } from './harness';

/**
 * `querySequence.run()` is a deliberately Promise-based public API (see `AGENTS.md`'s note on
 * `executeUntilSettled`), so nothing resolves until the microtask queue drains - which the
 * synchronous `s.flush()` never does. This repeatedly ticks the fake clock and yields to the
 * microtask queue until `predicate()` is true, working around that gap without touching the harness.
 */
const settleUntil = async (s: Scenario, predicate: () => boolean, rounds = 40) => {
  for (let i = 0; i < rounds && !predicate(); i++) {
    await s.settle(50);
  }
};

describe('stacks scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('runs one query per arg, aggregates loading, and exposes responses in order', () => {
    const s = scenario();
    s.api.on('GET', '/items/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 10 }));

    const getItem = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/items/${p.id}`);

    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }, { pathParams: { id: '3' } }],
      }),
    );

    s.tick();

    expect(stack.queries().length).toBe(3);
    expect(stack.allLoading()).toBe(true);
    expect(stack.anyLoading()).toBe(true);

    s.tick(10);

    expect(stack.anyLoading()).toBe(false);
    expect(stack.response()).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    expect(s.api.requestCount('GET', '/items/1')).toBe(1);
    expect(s.api.requestCount('GET', '/items/2')).toBe(1);
    expect(s.api.requestCount('GET', '/items/3')).toBe(1);

    c.destroy();
  });

  it.each([
    { strategy: 'oldest' as const, expected: ['2', '3'] },
    { strategy: 'newest' as const, expected: ['1', '2'] },
  ])('caps an appended stack by removing the $strategy queries', ({ strategy, expected }) => {
    const s = scenario();
    s.api.on('GET', '/bounded/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/bounded/${p.id}`);
    const id = signal('1');
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => ({ pathParams: { id: id() } }),
        append: true,
        maxQueries: 2,
        removeStrategy: strategy,
      }),
    );

    s.tick();
    id.set('2');
    s.tick();
    id.set('3');
    s.tick();

    expect(stack.queries().map((query) => query.args()?.pathParams?.id)).toEqual(expected);
    expect(stack.queries()).toHaveLength(2);

    c.destroy();
  });

  it('deduplicates repeated args inside an appended batch', () => {
    const s = scenario();
    s.api.on('GET', '/deduplicated/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/deduplicated/${p.id}`);
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '1' } }, { pathParams: { id: '2' } }],
        append: true,
      }),
    );

    s.tick();

    expect(stack.queries()).toHaveLength(2);
    expect(s.api.requestCount('GET', '/deduplicated/1')).toBe(1);
    expect(s.api.requestCount('GET', '/deduplicated/2')).toBe(1);

    c.destroy();
  });

  it('clears appended queries when a dependency changes', () => {
    const s = scenario();
    s.api.on('GET', '/feed/:group/:page', ({ params }) => ({
      body: { group: params['group'], page: params['page'] },
    }));

    const getFeed = s.get<{
      response: { group: string; page: string };
      pathParams: { group: string; page: string };
    }>((params) => `/feed/${params.group}/${params.page}`);
    const group = signal('a');
    const page = signal('1');
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getFeed,
        dependencies: () => ({ group: group() }),
        args: ({ group: currentGroup }) => ({ pathParams: { group: currentGroup, page: page() } }),
        append: true,
      }),
    );

    s.tick();
    page.set('2');
    s.tick();
    expect(stack.response()).toEqual([
      { group: 'a', page: '1' },
      { group: 'a', page: '2' },
    ]);

    group.set('b');
    s.tick();

    expect(stack.response()).toEqual([{ group: 'b', page: '2' }]);
    expect(stack.queries()).toHaveLength(1);

    c.destroy();
  });

  it('uses appendFn to prepend new queries and identify the latest query', () => {
    const s = scenario();
    s.api.on('GET', '/prepend/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/prepend/${p.id}`);
    const id = signal('1');
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => ({ pathParams: { id: id() } }),
        append: true,
        appendFn: (oldQueries, newQueries) => ({
          queries: [...newQueries, ...oldQueries],
          lastQuery: newQueries[0] ?? null,
        }),
      }),
    );

    s.tick();
    id.set('2');
    s.tick();

    expect(stack.response()).toEqual([{ id: '2' }, { id: '1' }]);
    expect(stack.firstQuery()?.args()?.pathParams?.id).toBe('2');
    expect(stack.lastQuery()?.args()?.pathParams?.id).toBe('2');

    c.destroy();
  });

  it('a paged stack appends the next page, resets to the initial page, and reads the page count from the response', () => {
    const s = scenario();
    s.api.on('GET', '/posts', ({ query }) => ({
      body: { items: [{ id: Number(query['page']) }], currentPage: Number(query['page']), totalPages: 3 },
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
      }),
    );

    s.tick();

    expect(pages.items()).toEqual([{ id: 1 }]);
    expect(pages.maxPagination()?.totalPages).toBe(3);

    pages.fetchNextPage();
    s.tick();

    expect(pages.items()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(pages.queries().length).toBe(2);

    pages.reset();
    s.tick();

    expect(pages.items()).toEqual([{ id: 1 }]);
    expect(pages.queries().length).toBe(1);
    expect(pages.maxPagination()?.totalPages).toBe(3);

    c.destroy();
  });

  it('execute() on a paged stack still re-runs an already-loaded page while another page is in flight', () => {
    const s = scenario();
    s.api.on('GET', '/posts', ({ query }) => ({
      body: {
        items: [{ id: Number(query['page']) }],
        currentPage: Number(query['page']),
        nextPage: Number(query['page']) + 1,
        totalPageCount: 3,
        itemsPerPage: 1,
        totalHits: 3,
      },
      delay: 20,
    }));

    const getPosts = s.get<{
      response: Paginated<{ id: number }>;
      queryParams: { page: number };
    }>('/posts');

    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPosts,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
      }),
    );

    s.tick(20);
    expect(pages.items()).toEqual([{ id: 1 }]);

    pages.fetchNextPage();
    s.tick();

    expect(pages.loading()).toBe(true);
    expect(pages.canFetchNextPage()).toBe(false);

    const page1RequestsBefore = s.api.requests.filter((r) => r.query['page'] === '1').length;
    const page2RequestsBefore = s.api.requests.filter((r) => r.query['page'] === '2').length;

    // Documented: `blockExecutionDuringLoading` (default false) governs `fetchNextPage`/`fetchPreviousPage`
    // only - `execute()` re-runs every page unconditionally. Page 1 (settled) gets a genuine new request;
    // page 2's identical in-flight request is deduped the same way two consumers of the same args share one call.
    pages.execute();

    expect(s.api.requests.filter((r) => r.query['page'] === '1').length).toBe(page1RequestsBefore + 1);
    expect(s.api.requests.filter((r) => r.query['page'] === '2').length).toBe(page2RequestsBefore);

    s.tick(20);

    expect(pages.items()).toEqual([{ id: 1 }, { id: 2 }]);

    c.destroy();
  });

  it('fetchPreviousPage returns the query for the page it fetched', () => {
    const s = scenario();
    s.api.on('GET', '/backward-pages', ({ query }) => ({
      body: {
        items: [{ id: Number(query['page']) }],
        currentPage: Number(query['page']),
        nextPage: Number(query['page']) + 1,
        totalPageCount: 5,
        itemsPerPage: 1,
        totalHits: 5,
      },
      delay: 10,
    }));

    const getPosts = s.get<{ response: Paginated<{ id: number }>; queryParams: { page: number } }>('/backward-pages');

    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPosts,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
        initialPage: 3,
      }),
    );

    s.tick(10);
    expect(pages.items()).toEqual([{ id: 3 }]);

    const previous = pages.fetchPreviousPage();
    s.tick(10);

    expect(previous?.args()).toEqual({ queryParams: { page: 2 } });
    expect(previous?.response()?.currentPage).toBe(2);
    expect(pages.lastQuery()?.args()).toEqual({ queryParams: { page: 3 } });

    c.destroy();
  });

  it('blockExecutionDuringLoading blocks a backward fetch while a page loads', () => {
    const s = scenario();
    s.api.on('GET', '/blocked-pages', ({ query }) => ({
      body: {
        items: [{ id: Number(query['page']) }],
        currentPage: Number(query['page']),
        nextPage: Number(query['page']) + 1,
        totalPageCount: 5,
        itemsPerPage: 1,
        totalHits: 5,
      },
      delay: 20,
    }));

    const getPosts = s.get<{ response: Paginated<{ id: number }>; queryParams: { page: number } }>('/blocked-pages');

    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPosts,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
        initialPage: 3,
        blockExecutionDuringLoading: true,
      }),
    );

    s.tick();
    expect(pages.loading()).toBe(true);

    expect(pages.fetchPreviousPage()).toBe(null);
    expect(s.api.requests.filter((r) => r.query['page'] === '2').length).toBe(0);
    expect(pages.queries().length).toBe(1);

    s.tick(20);

    const previous = pages.fetchPreviousPage();
    s.tick(20);

    expect(previous?.args()).toEqual({ queryParams: { page: 2 } });
    expect(pages.items()).toEqual([{ id: 2 }, { id: 3 }]);

    c.destroy();
  });

  it('selectively re-executes a matching page and its neighbors', () => {
    const s = scenario();
    s.api.on('GET', '/selective-pages', ({ query }) => ({
      body: {
        items: [{ id: Number(query['page']) }],
        currentPage: Number(query['page']),
        nextPage: Number(query['page']) < 4 ? Number(query['page']) + 1 : null,
        totalPageCount: 4,
        itemsPerPage: 1,
        totalHits: 4,
      },
    }));

    const getPages = s.get<{ response: Paginated<{ id: number }>; queryParams: { page: number } }>('/selective-pages');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
      }),
    );

    s.tick();
    pages.fetchNextPage();
    s.tick();
    pages.fetchNextPage();
    s.tick();
    pages.fetchNextPage();
    s.tick();

    pages.execute({ where: (item) => item.id === 3 });
    s.tick();

    const requestCount = (page: string) => s.api.requests.filter((request) => request.query['page'] === page).length;
    expect(requestCount('1')).toBe(1);
    expect(requestCount('2')).toBe(2);
    expect(requestCount('3')).toBe(2);
    expect(requestCount('4')).toBe(2);

    c.destroy();
  });

  it('a batch sends one request per unique arg', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'], archived: true } }));

    const patchPost = s.patch<{ response: { id: string; archived: boolean }; pathParams: { id: string } }>(
      (p) => `/posts/${p.id}`,
    );

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPost,
        args: (item: { id: string }) => ({ pathParams: { id: item.id } }),
      }),
    );

    let result: ObservedValueOf<ReturnType<typeof batch.run>> | undefined;
    batch.run([{ id: '1' }, { id: '2' }, { id: '3' }]).subscribe((r) => (result = r));

    s.flush();

    expect(s.api.requestCount('PATCH', '/posts/1')).toBe(1);
    expect(s.api.requestCount('PATCH', '/posts/2')).toBe(1);
    expect(s.api.requestCount('PATCH', '/posts/3')).toBe(1);
    expect(result?.ok).toBe(true);
    expect(result?.succeeded.length).toBe(3);

    c.destroy();
  });

  it('a failing request inside a batch does not leave the batch running forever, and the batch can run again', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));
    s.api.once('PATCH', '/posts/2', () => ({ status: 500, body: { message: 'boom' } }));

    const patchPost = s.patch<{ response: { id: string }; pathParams: { id: string } }>((p) => `/posts/${p.id}`);

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({ queryCreator: patchPost, args: (item: { id: string }) => ({ pathParams: { id: item.id } }) }),
    );

    let firstResult: ObservedValueOf<ReturnType<typeof batch.run>> | undefined;
    batch.run([{ id: '1' }, { id: '2' }, { id: '3' }]).subscribe((r) => (firstResult = r));

    s.flush();

    expect(firstResult?.ok).toBe(false);
    expect(firstResult?.failed.length).toBe(1);
    expect(batch.running()).toBe(false);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);

    let secondResult: ObservedValueOf<ReturnType<typeof batch.retryFailed>> | undefined;
    expect(() => batch.retryFailed().subscribe((r) => (secondResult = r))).not.toThrow();

    s.flush();

    expect(batch.running()).toBe(false);
    expect(secondResult?.ok).toBe(true);
    expect(secondResult?.succeeded.length).toBe(3);

    c.destroy();
  });

  it('a batch whose args function throws does not stay running forever (scan finding: no finally around the outer stream)', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const patchPost = s.patch<{ response: { id: string }; pathParams: { id: string } }>((p) => `/posts/${p.id}`);

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPost,
        args: (item: { id: string }) => {
          if (item.id === '2') throw new Error('bad item');
          return { pathParams: { id: item.id } };
        },
      }),
    );

    let sawError = false;
    batch.run([{ id: '1' }, { id: '2' }, { id: '3' }]).subscribe({ error: () => (sawError = true) });

    s.flush();

    expect(sawError).toBe(true);
    expect(batch.running()).toBe(false);

    let ranAgain = false;
    expect(() => batch.run([{ id: '4' }]).subscribe(() => (ranAgain = true))).not.toThrow();

    s.flush();

    expect(ranAgain).toBe(true);

    c.destroy();
  });

  it('a sequence runs its steps in order, threading each response into the next', async () => {
    const s = scenario();
    s.api.on('POST', '/orders', () => ({ body: { id: 'order-1' } }));
    s.api.on('POST', '/payments', () => ({ body: { id: 'payment-1' } }));
    s.api.on('POST', '/confirm', () => ({ body: { confirmed: true } }));

    const createOrder = s.post<{ response: { id: string } }>('/orders');
    const createPayment = s.post<{ response: { id: string }; body: { orderId: string } }>('/payments');
    const confirmOrder = s.post<{ response: { confirmed: boolean }; body: { orderId: string; paymentId: string } }>(
      '/confirm',
    );

    const c = s.consumer();
    const checkout = c.run(() => {
      const orderQuery = createOrder();
      const paymentQuery = createPayment();
      const confirmQuery = confirmOrder();

      return querySequence(orderQuery, () => ({ args: {} }))
        .then(paymentQuery, (order) => ({ args: { body: { orderId: order.id } } }))
        .then(confirmQuery, (payment, [order]) => ({
          args: { body: { orderId: order.id, paymentId: payment.id } },
        }));
    });

    let result: Awaited<ReturnType<typeof checkout.run>> | undefined;
    checkout.run().then((r) => (result = r));

    await settleUntil(s, () => result !== undefined);

    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.responses).toEqual([{ id: 'order-1' }, { id: 'payment-1' }, { confirmed: true }]);
    }
    expect(s.api.requests.map((r) => r.path)).toEqual(['/orders', '/payments', '/confirm']);

    c.destroy();
  });

  it('a failing step stops the sequence, resets its running state, and the sequence can run again', async () => {
    const s = scenario();
    s.api.on('POST', '/orders', () => ({ body: { id: 'order-1' } }));
    s.api.once('POST', '/payments', () => ({ status: 500, body: { message: 'boom' } }));
    s.api.on('POST', '/payments', () => ({ body: { id: 'payment-1' } }));
    s.api.on('POST', '/confirm', () => ({ body: { confirmed: true } }));

    const createOrder = s.post<{ response: { id: string } }>('/orders');
    const createPayment = s.post<{ response: { id: string }; body: { orderId: string } }>('/payments');
    const confirmOrder = s.post<{ response: { confirmed: boolean }; body: { orderId: string; paymentId: string } }>(
      '/confirm',
    );

    const c = s.consumer();
    const checkout = c.run(() => {
      const orderQuery = createOrder();
      const paymentQuery = createPayment();
      const confirmQuery = confirmOrder();

      return querySequence(orderQuery, () => ({ args: {} }))
        .then(paymentQuery, (order) => ({ args: { body: { orderId: order.id } } }))
        .then(confirmQuery, (payment, [order]) => ({
          args: { body: { orderId: order.id, paymentId: payment.id } },
        }));
    });

    let firstResult: Awaited<ReturnType<typeof checkout.run>> | undefined;
    checkout.run().then((r) => (firstResult = r));

    await settleUntil(s, () => firstResult !== undefined);

    expect(firstResult?.ok).toBe(false);
    if (firstResult && !firstResult.ok) {
      expect(firstResult.failedAt).toBe(1);
    }
    expect(checkout.running()).toBe(false);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);

    let secondResult: Awaited<ReturnType<typeof checkout.run>> | undefined;
    expect(() => checkout.run().then((r) => (secondResult = r))).not.toThrow();

    await settleUntil(s, () => secondResult !== undefined);

    expect(secondResult?.ok).toBe(true);
    expect(checkout.running()).toBe(false);

    c.destroy();
  });

  it('rejects a second sequence run while the first one is in flight', async () => {
    const s = scenario();
    s.api.on('POST', '/slow-sequence', () => ({ body: { ok: true }, delay: 100 }));

    const createStep = s.post<{ response: { ok: boolean } }>('/slow-sequence');
    const c = s.consumer();
    const sequence = c.run(() => querySequence(createStep(), () => ({ args: {} })));
    let firstResult: Awaited<ReturnType<typeof sequence.run>> | undefined;

    sequence.run().then((result) => (firstResult = result));

    await expect(sequence.run()).rejects.toThrow(/ET900|already running/);
    await settleUntil(s, () => firstResult !== undefined);

    expect(firstResult?.ok).toBe(true);
    expect(s.api.requestCount('POST', '/slow-sequence')).toBe(1);

    c.destroy();
  });

  it('destroying a stack mid-flight aborts its requests', () => {
    const s = scenario();
    s.api.on('GET', '/items/:id', () => ({ body: { ready: true }, delay: 500 }));

    const getItem = s.get<{ response: { ready: boolean }; pathParams: { id: string } }>((p) => `/items/${p.id}`);

    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }],
      }),
    );

    s.tick();

    expect(stack.queries().length).toBe(2);
    expect(s.api.pending().length).toBe(2);

    c.destroy();

    expect(s.api.pending().length).toBe(0);
    expect(s.api.requests.every((r) => r.aborted)).toBe(true);
  });
});
