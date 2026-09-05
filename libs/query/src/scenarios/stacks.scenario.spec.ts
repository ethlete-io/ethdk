import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import {
  ContentfulGqlLikePaginated,
  DynLikePaginated,
  GgLikePaginated,
  NormalizedPagination,
  Paginated,
} from '@ethlete/types';
import {
  contentfulGqlLikePaginationAdapter,
  createPagedQueryStack,
  createQueryBatch,
  createQueryStack,
  dynLikePaginationAdapter,
  ethletePaginationAdapter,
  fakePaginationAdapter,
  ggLikePaginationAdapter,
  querySequence,
  transformArrayResponse,
  transformPaginatedResponse,
  withArgs,
  withResponseUpdate,
  withSuccessHandling,
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

type ItemQueryArgs = { response: { id: string }; pathParams: { id: string } };

const ethletePage = (page: number, totalPageCount: number) => ({
  items: [{ id: page }],
  currentPage: page,
  nextPage: page < totalPageCount ? page + 1 : null,
  totalPageCount,
  itemsPerPage: 1,
  totalHits: totalPageCount,
});

type PagedQueryArgs = { response: Paginated<{ id: number }>; queryParams: { page: number } };

type PaginationAdapterCase = {
  name: string;
  body: unknown;
  normalize: (response: unknown) => NormalizedPagination<unknown>;
  expected: NormalizedPagination<unknown>;
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

  it('creates no query when the stack args function returns null', () => {
    const s = scenario();
    s.api.on('GET', '/optional/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<ItemQueryArgs>((p) => `/optional/${p.id}`);
    const id = signal<string | null>(null);
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => {
          const currentId = id();

          return currentId === null ? null : { pathParams: { id: currentId } };
        },
      }),
    );

    s.tick();

    expect(stack.queries()).toHaveLength(0);
    expect(s.api.requests).toHaveLength(0);

    id.set('1');
    s.tick();

    expect(stack.queries()).toHaveLength(1);
    expect(stack.response()).toEqual([{ id: '1' }]);

    c.destroy();
  });

  it('applies a stack feature to every query it runs', () => {
    const s = scenario();
    s.api.on('GET', '/featured/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<ItemQueryArgs>((p) => `/featured/${p.id}`);
    const handled: string[] = [];
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }, { pathParams: { id: '3' } }],
        features: [withSuccessHandling<ItemQueryArgs>({ handler: (item) => handled.push(item.id) })],
      }),
    );

    s.tick();

    expect(stack.queries()).toHaveLength(3);
    expect([...new Set(handled)]).toEqual(['1', '2', '3']);

    c.destroy();
  });

  it.fails('runs a stack feature once per response, like a standalone query', () => {
    // stacks.md:22 "an array (one query each)" - a stack without `append` builds a second, discarded
    // query per arg, so every feature side effect runs twice for the one response (features.md:96).
    const s = scenario();
    s.api.on('GET', '/once-per-response/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<ItemQueryArgs>((p) => `/once-per-response/${p.id}`);
    const handled: string[] = [];
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }],
        features: [withSuccessHandling<ItemQueryArgs>({ handler: (item) => handled.push(item.id) })],
      }),
    );

    s.tick();

    expect(stack.queries()).toHaveLength(2);
    expect(handled).toEqual(['1', '2']);

    c.destroy();
  });

  it('throws when a stack is given withArgs or withResponseUpdate as a feature', () => {
    const s = scenario();
    s.api.on('GET', '/rejected/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<ItemQueryArgs>((p) => `/rejected/${p.id}`);
    const c = s.consumer();

    expect(() =>
      c.run(() =>
        createQueryStack({
          queryCreator: getItem,
          args: () => ({ pathParams: { id: '1' } }),
          features: [withArgs<ItemQueryArgs>(() => ({ pathParams: { id: '1' } }))],
        }),
      ),
    ).toThrow(/withArgs/);

    expect(() =>
      c.run(() =>
        createQueryStack({
          queryCreator: getItem,
          args: () => ({ pathParams: { id: '1' } }),
          features: [withResponseUpdate<ItemQueryArgs>({ updater: ({ currentResponse }) => currentResponse })],
        }),
      ),
    ).toThrow(/withResponseUpdate/);

    s.tick();

    expect(s.api.requests).toHaveLength(0);

    c.destroy();
  });

  it('flattens the stack responses through transformArrayResponse', () => {
    const s = scenario();
    s.api.on('GET', '/groups/:id', ({ params }) => ({
      body: [{ id: `${params['id']}-a` }, { id: `${params['id']}-b` }],
    }));

    const getGroup = s.get<{ response: { id: string }[]; pathParams: { id: string } }>((p) => `/groups/${p.id}`);
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getGroup,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }],
        transform: transformArrayResponse,
      }),
    );

    s.tick();

    expect(stack.response()).toEqual([{ id: '1-a' }, { id: '1-b' }, { id: '2-a' }, { id: '2-b' }]);

    c.destroy();
  });

  it('flattens paginated stack responses through transformPaginatedResponse', () => {
    const s = scenario();
    s.api.on('GET', '/paginated-groups/:id', ({ params }) => ({
      body: { items: [{ id: `${params['id']}-a` }, { id: `${params['id']}-b` }] },
    }));

    const getGroup = s.get<{ response: { items: { id: string }[] }; pathParams: { id: string } }>(
      (p) => `/paginated-groups/${p.id}`,
    );
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getGroup,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }],
        transform: transformPaginatedResponse,
      }),
    );

    s.tick();

    expect(stack.response()).toEqual([{ id: '1-a' }, { id: '1-b' }, { id: '2-a' }, { id: '2-b' }]);

    c.destroy();
  });

  it('runs duplicate args again with deduplicateArgs: false', () => {
    const s = scenario();
    s.api.on('GET', '/kept/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<ItemQueryArgs>((p) => `/kept/${p.id}`);
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '1' } }, { pathParams: { id: '2' } }],
        append: true,
        deduplicateArgs: false,
      }),
    );

    s.tick();

    expect(stack.queries()).toHaveLength(3);
    expect(stack.response()).toEqual([{ id: '1' }, { id: '1' }, { id: '2' }]);

    c.destroy();
  });

  it('dedupes by a custom argsKeyFn instead of the default JSON.stringify', () => {
    const s = scenario();
    s.api.on('GET', '/keyed/:id', ({ params, query }) => ({
      body: { id: params['id'], variant: query['variant'] ?? null },
    }));

    const getItem = s.get<{
      response: { id: string; variant: string | null };
      pathParams: { id: string };
      queryParams: { variant: string };
    }>((p) => `/keyed/${p.id}`);
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [
          { pathParams: { id: '1' }, queryParams: { variant: 'a' } },
          { pathParams: { id: '1' }, queryParams: { variant: 'b' } },
        ],
        append: true,
        argsKeyFn: (args) => args?.pathParams?.id ?? '',
      }),
    );

    s.tick();

    expect(stack.queries()).toHaveLength(1);
    expect(s.api.requests).toHaveLength(1);
    expect(stack.response()).toEqual([{ id: '1', variant: 'a' }]);

    c.destroy();
  });

  it('reports loadingProgress as each query in the stack settles', () => {
    const s = scenario();
    s.api.on('GET', '/progress/1', () => ({ body: { id: '1' }, delay: 10 }));
    s.api.on('GET', '/progress/2', () => ({ body: { id: '2' }, delay: 20 }));
    s.api.on('GET', '/progress/3', () => ({ body: { id: '3' }, delay: 30 }));

    const getItem = s.get<ItemQueryArgs>((p) => `/progress/${p.id}`);
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }, { pathParams: { id: '3' } }],
      }),
    );

    s.tick();
    expect(stack.loadingProgress()).toEqual({ loaded: 0, total: 3 });

    s.tick(10);
    expect(stack.loadingProgress()).toEqual({ loaded: 1, total: 3 });

    s.tick(10);
    expect(stack.loadingProgress()).toEqual({ loaded: 2, total: 3 });

    s.tick(10);
    expect(stack.loadingProgress()).toEqual({ loaded: 3, total: 3 });
    expect(stack.anyLoading()).toBe(false);

    c.destroy();
  });

  it('exposes a failed query through anyError and errors', () => {
    const s = scenario();
    s.api.on('GET', '/mixed/2', () => ({ status: 500, body: { message: 'boom' } }));
    s.api.on('GET', '/mixed/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<ItemQueryArgs>((p) => `/mixed/${p.id}`);
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }, { pathParams: { id: '3' } }],
      }),
    );

    s.tick();

    expect(stack.errors()).toHaveLength(1);
    expect(stack.anyError()?.code).toBe(500);
    expect(stack.response()).toEqual([{ id: '1' }, null, { id: '3' }]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);

    c.destroy();
  });

  it('retryFailed re-runs only the failed queries in the stack', () => {
    const s = scenario();
    s.api.once('GET', '/retried/2', () => ({ status: 500, body: { message: 'boom' } }));
    s.api.on('GET', '/retried/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<ItemQueryArgs>((p) => `/retried/${p.id}`);
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }, { pathParams: { id: '3' } }],
      }),
    );

    s.tick();

    expect(stack.errors()).toHaveLength(1);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);

    stack.retryFailed();
    s.tick();

    expect(s.api.requestCount('GET', '/retried/1')).toBe(1);
    expect(s.api.requestCount('GET', '/retried/2')).toBe(2);
    expect(s.api.requestCount('GET', '/retried/3')).toBe(1);
    expect(stack.errors()).toHaveLength(0);
    expect(stack.response()).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);

    c.destroy();
  });

  it('clear() drops every query in the stack', () => {
    const s = scenario();
    s.api.on('GET', '/cleared/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<ItemQueryArgs>((p) => `/cleared/${p.id}`);
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }],
        append: true,
      }),
    );

    s.tick();
    expect(stack.queries()).toHaveLength(2);

    stack.clear();
    s.tick();

    expect(stack.queries()).toHaveLength(0);
    expect(stack.firstQuery()).toBe(null);
    expect(stack.lastQuery()).toBe(null);
    expect(stack.response()).toEqual([]);
    expect(s.api.requestCount('GET', '/cleared/1')).toBe(1);
    expect(s.api.requestCount('GET', '/cleared/2')).toBe(1);

    c.destroy();
  });

  it('re-executes every query in the stack, serving fresh entries from cache with allowCache', () => {
    const s = scenario();
    s.api.on('GET', '/stack-cached/:id', ({ params }) => ({
      body: { id: params['id'] },
      headers: { 'cache-control': 'max-age=20' },
    }));

    const getItem = s.get<ItemQueryArgs>((p) => `/stack-cached/${p.id}`);
    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }],
      }),
    );

    s.tick();
    expect(s.api.requestCount('GET', '/stack-cached/1')).toBe(1);
    expect(s.api.requestCount('GET', '/stack-cached/2')).toBe(1);

    // max-age=20 halves to a 10s freshness window - well inside it, allowCache must not hit the server.
    s.tick(9_000);
    stack.execute({ allowCache: true });
    s.tick();

    expect(s.api.requestCount('GET', '/stack-cached/1')).toBe(1);
    expect(s.api.requestCount('GET', '/stack-cached/2')).toBe(1);

    stack.execute();
    s.tick();

    expect(s.api.requestCount('GET', '/stack-cached/1')).toBe(2);
    expect(s.api.requestCount('GET', '/stack-cached/2')).toBe(2);
    expect(stack.response()).toEqual([{ id: '1' }, { id: '2' }]);

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

  it.each([
    {
      name: 'ethletePaginationAdapter',
      body: { items: [{ id: 1 }], currentPage: 2, totalPageCount: 4, itemsPerPage: 5, totalHits: 20 },
      normalize: (response: unknown) => ethletePaginationAdapter(response as Paginated<{ id: number }>),
      expected: { items: [{ id: 1 }], totalPages: 4, currentPage: 2, itemsPerPage: 5, totalHits: 20 },
    },
    {
      name: 'ggLikePaginationAdapter',
      body: { items: [{ id: 1 }], currentPage: 2, totalPageCount: 4, itemsPerPage: 5, totalHits: 20 },
      normalize: (response: unknown) => ggLikePaginationAdapter(response as GgLikePaginated<{ id: number }>),
      expected: { items: [{ id: 1 }], totalPages: 4, currentPage: 2, itemsPerPage: 5, totalHits: 20 },
    },
    {
      name: 'dynLikePaginationAdapter',
      body: { items: [{ id: 1 }], currentPage: 2, totalPages: 4, limit: 5, totalHits: 20 },
      normalize: (response: unknown) => dynLikePaginationAdapter(response as DynLikePaginated<{ id: number }>),
      expected: { items: [{ id: 1 }], totalPages: 4, currentPage: 2, itemsPerPage: 5, totalHits: 20 },
    },
    {
      name: 'contentfulGqlLikePaginationAdapter',
      body: { items: [{ id: 1 }], limit: 5, skip: 5, total: 20 },
      normalize: (response: unknown) =>
        contentfulGqlLikePaginationAdapter(response as ContentfulGqlLikePaginated<{ id: number }>),
      expected: { items: [{ id: 1 }], totalPages: 4, currentPage: 2, itemsPerPage: 5, totalHits: 20 },
    },
    {
      name: 'fakePaginationAdapter',
      body: { id: 1 },
      normalize: (response: unknown) => fakePaginationAdapter(20)(response),
      expected: { items: [{ id: 1 }], totalPages: 20, currentPage: 1, itemsPerPage: 1, totalHits: 20 },
    },
  ] as PaginationAdapterCase[])(
    'normalizes the $name shape to items, totalPages, currentPage, itemsPerPage and totalHits',
    ({ body, normalize, expected }) => {
      const s = scenario();
      s.api.on('GET', '/adapter-pages', () => ({ body }));

      const getPage = s.get<{ response: unknown; queryParams: { page: number } }>('/adapter-pages');
      const c = s.consumer();
      const pages = c.run(() =>
        createPagedQueryStack({
          queryCreator: getPage,
          responseNormalizer: normalize,
          args: (page) => ({ queryParams: { page } }),
        }),
      );

      s.tick();

      expect(pages.maxPagination()).toEqual(expected);
      expect(pages.items()).toEqual(expected.items);

      c.destroy();
    },
  );

  it('resets a paged stack to its initial page when a signal read by args changes', () => {
    const s = scenario();
    s.api.on('GET', '/filtered-pages', ({ query }) => ({
      body: {
        items: [{ id: `${query['filter']}-${query['page']}` }],
        currentPage: Number(query['page']),
        nextPage: Number(query['page']) + 1,
        totalPageCount: 3,
        itemsPerPage: 1,
        totalHits: 3,
      },
    }));

    const getPages = s.get<{
      response: Paginated<{ id: string }>;
      queryParams: { page: number; filter: string };
    }>('/filtered-pages');
    const filter = signal('a');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page, filter: filter() } }),
      }),
    );

    s.tick();
    pages.fetchNextPage();
    s.tick();

    expect(pages.items()).toEqual([{ id: 'a-1' }, { id: 'a-2' }]);

    filter.set('b');
    s.tick();

    expect(pages.queries()).toHaveLength(1);
    expect(pages.items()).toEqual([{ id: 'b-1' }]);
    expect(pages.maxPagination()?.currentPage).toBe(1);

    c.destroy();
  });

  it('starts a paged stack at page 1 by default', () => {
    const s = scenario();
    s.api.on('GET', '/default-pages', ({ query }) => ({ body: ethletePage(Number(query['page']), 3) }));

    const getPages = s.get<PagedQueryArgs>('/default-pages');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
      }),
    );

    s.tick();

    expect(s.api.requests.map((request) => request.query['page'])).toEqual(['1']);
    expect(pages.minPagination()?.currentPage).toBe(1);
    expect(pages.isFirstPageLoaded()).toBe(true);
    expect(pages.canFetchPreviousPage()).toBe(false);
    expect(pages.canFetchNextPage()).toBe(true);

    c.destroy();
  });

  it('fetches pages in both directions from a higher initial page', () => {
    const s = scenario();
    s.api.on('GET', '/two-way-pages', ({ query }) => ({ body: ethletePage(Number(query['page']), 5) }));

    const getPages = s.get<PagedQueryArgs>('/two-way-pages');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
        initialPage: 3,
      }),
    );

    s.tick();
    expect(pages.items()).toEqual([{ id: 3 }]);

    pages.fetchNextPage();
    s.tick();
    pages.fetchPreviousPage();
    s.tick();

    expect(pages.items()).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }]);
    expect(pages.queries()).toHaveLength(3);

    c.destroy();
  });

  it('exposes minPagination for the lowest loaded page', () => {
    const s = scenario();
    s.api.on('GET', '/min-pages', ({ query }) => ({ body: ethletePage(Number(query['page']), 5) }));

    const getPages = s.get<PagedQueryArgs>('/min-pages');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
        initialPage: 3,
      }),
    );

    s.tick();

    expect(pages.minPagination()?.currentPage).toBe(3);
    expect(pages.maxPagination()?.currentPage).toBe(3);

    pages.fetchPreviousPage();
    s.tick();

    expect(pages.minPagination()?.currentPage).toBe(2);
    expect(pages.maxPagination()?.currentPage).toBe(3);

    c.destroy();
  });

  it('ignores a fetchNextPage call mid-flight with blockExecutionDuringLoading: true', () => {
    const s = scenario();
    s.api.on('GET', '/blocked-next-pages', ({ query }) => ({ body: ethletePage(Number(query['page']), 5), delay: 20 }));

    const getPages = s.get<PagedQueryArgs>('/blocked-next-pages');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
        blockExecutionDuringLoading: true,
      }),
    );

    s.tick(20);
    expect(pages.items()).toEqual([{ id: 1 }]);

    const second = pages.fetchNextPage();
    s.tick();

    expect(pages.loading()).toBe(true);
    expect(pages.fetchNextPage()).toBe(null);
    expect(s.api.requests.filter((request) => request.query['page'] === '3')).toHaveLength(0);
    expect(pages.queries()).toHaveLength(2);

    s.tick(20);

    expect(second?.response()?.currentPage).toBe(2);
    expect(pages.items()).toEqual([{ id: 1 }, { id: 2 }]);

    c.destroy();
  });

  it('reports isFirstLoad only until the first page settles', () => {
    const s = scenario();
    s.api.on('GET', '/first-load-pages', ({ query }) => ({ body: ethletePage(Number(query['page']), 3), delay: 20 }));

    const getPages = s.get<PagedQueryArgs>('/first-load-pages');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
      }),
    );

    s.tick();
    expect(pages.isFirstLoad()).toBe(true);

    s.tick(20);
    expect(pages.isFirstLoad()).toBe(false);

    pages.fetchNextPage();
    s.tick();

    expect(pages.loading()).toBe(true);
    expect(pages.isFirstLoad()).toBe(false);

    s.tick(20);

    c.destroy();
  });

  it('reports canFetchNextPage false while an already loaded page refreshes', () => {
    const s = scenario();
    s.api.on('GET', '/refreshed-pages', ({ query }) => ({ body: ethletePage(Number(query['page']), 3), delay: 20 }));

    const getPages = s.get<PagedQueryArgs>('/refreshed-pages');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
        initialPage: 2,
      }),
    );

    s.tick(20);

    expect(pages.canFetchNextPage()).toBe(true);
    expect(pages.canFetchPreviousPage()).toBe(true);

    pages.execute();
    s.tick();

    expect(pages.loading()).toBe(true);
    expect(pages.canFetchNextPage()).toBe(false);
    expect(pages.canFetchPreviousPage()).toBe(false);

    s.tick(20);

    expect(pages.canFetchNextPage()).toBe(true);
    expect(pages.canFetchPreviousPage()).toBe(true);

    c.destroy();
  });

  it('reports isFirstPageLoaded only once a stack started at a higher page has fetched back to page 1', () => {
    const s = scenario();
    s.api.on('GET', '/edge-pages', ({ query }) => ({ body: ethletePage(Number(query['page']), 2) }));

    const getPages = s.get<PagedQueryArgs>('/edge-pages');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
        initialPage: 2,
      }),
    );

    s.tick();

    expect(pages.isFirstPageLoaded()).toBe(false);
    expect(pages.isLastPageLoaded()).toBe(true);

    pages.fetchPreviousPage();
    s.tick();

    expect(pages.isFirstPageLoaded()).toBe(true);
    expect(pages.isLastPageLoaded()).toBe(true);
    expect(pages.canFetchPreviousPage()).toBe(false);

    c.destroy();
  });

  it('reset({ initialPage }) restarts the paged stack at the given page', () => {
    const s = scenario();
    s.api.on('GET', '/reset-pages', ({ query }) => ({ body: ethletePage(Number(query['page']), 5) }));

    const getPages = s.get<PagedQueryArgs>('/reset-pages');
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

    expect(pages.items()).toEqual([{ id: 1 }, { id: 2 }]);

    pages.reset({ initialPage: 4 });
    s.tick();

    expect(pages.queries()).toHaveLength(1);
    expect(pages.items()).toEqual([{ id: 4 }]);
    expect(pages.minPagination()?.currentPage).toBe(4);
    expect(pages.isFirstPageLoaded()).toBe(false);

    c.destroy();
  });

  it('serves a fresh page from cache when the paged stack executes with allowCache', () => {
    const s = scenario();
    let revision = 0;
    s.api.on('GET', '/cached-pages', ({ query }) => {
      revision++;

      return {
        body: { ...ethletePage(Number(query['page']), 3), items: [{ id: Number(query['page']), revision }] },
        headers: { 'cache-control': 'max-age=20' },
      };
    });

    const getPages = s.get<{
      response: Paginated<{ id: number; revision: number }>;
      queryParams: { page: number };
    }>('/cached-pages');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
      }),
    );

    s.tick();
    expect(pages.items()).toEqual([{ id: 1, revision: 1 }]);

    // max-age=20 halves to a 10s freshness window - well inside it, allowCache must not hit the server.
    s.tick(9_000);
    pages.execute({ allowCache: true });
    s.tick();

    expect(s.api.requestCount('GET', '/cached-pages')).toBe(1);
    expect(pages.items()).toEqual([{ id: 1, revision: 1 }]);

    s.tick(1_001);
    pages.execute({ allowCache: true });
    s.tick();

    expect(s.api.requestCount('GET', '/cached-pages')).toBe(2);
    expect(pages.items()).toEqual([{ id: 1, revision: 2 }]);

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
