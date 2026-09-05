import { HttpErrorResponse } from '@angular/common/http';
import {
  AnyQueryBatch,
  clearQueryDevtoolsTombstones,
  createQueryBatch,
  isQueryDevtoolsEnabled,
  MAX_QUERY_BATCH_TOMBSTONES,
  provideQueryDevtools,
  QueryArgsOf,
  QueryBatchDevtoolsHandle,
  QueryBatchItemResult,
  QueryBatchResult,
  queryDevtoolsEntries,
  queryErrorMessage,
  querySequence,
  withArgs,
  withDefaultRetry,
} from '../index';
import { Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Scenario, sequence, useScenario } from './harness';

type Post = { id: string };

const posts = (...ids: string[]): Post[] => ids.map((id) => ({ id }));

const ids = (results: readonly { item: Post }[]) => results.map((r) => r.item.id);

const patchPosts = (s: Scenario) =>
  s.patch<{ response: { id: string }; pathParams: { id: string }; body?: { archived: boolean } }>(
    (p) => `/posts/${p.id}`,
  );

type PatchPostArgs = QueryArgsOf<ReturnType<typeof patchPosts>>;

const capture = <T>(source: Observable<T>) => {
  const holder: { value?: T; error?: unknown } = {};
  source.subscribe({ next: (v) => (holder.value = v), error: (e) => (holder.error = e) });

  return holder;
};

const httpStatusError = (status: number) => (entry: { error: unknown }) =>
  entry.error instanceof HttpErrorResponse && entry.error.status === status;

const numbered = (count: number): Post[] => posts(...Array.from({ length: count }, (_, i) => String(i + 1)));

describe('batching scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('keeps at most four requests in flight by default and drains the list in waves', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({ queryCreator: patchPosts(s), args: (post: Post) => ({ pathParams: { id: post.id } }) }),
    );

    expect(batch.status()).toBe('idle');
    expect(batch.progress()).toBe(0);

    const result = capture(batch.run(posts('1', '2', '3', '4', '5', '6', '7', '8', '9', '10')));
    s.tick();

    expect(batch.status()).toBe('running');
    expect(batch.running()).toBe(true);
    expect(batch.total()).toBe(10);
    expect(batch.inFlight()).toBe(4);
    expect(s.api.pending().length).toBe(4);
    expect(s.api.requests.map((r) => r.path)).toEqual(['/posts/1', '/posts/2', '/posts/3', '/posts/4']);

    s.tick(100);

    expect(batch.completed()).toBe(4);
    expect(batch.progress()).toBe(40);
    expect(batch.inFlight()).toBe(4);
    expect(s.api.pending().length).toBe(4);

    s.tick(100);

    expect(batch.completed()).toBe(8);
    expect(batch.inFlight()).toBe(2);

    s.tick(100);

    expect(result.value?.ok).toBe(true);
    expect(batch.status()).toBe('success');
    expect(batch.running()).toBe(false);
    expect(batch.completed()).toBe(10);
    expect(batch.progress()).toBe(100);
    expect(batch.inFlight()).toBe(0);
    expect(batch.succeeded()).toBe(10);
    expect(s.api.requests.length).toBe(10);

    c.destroy();
  });

  it('concurrency 1 sends the items one after another in input order', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 10 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 1,
      }),
    );

    const result = capture(batch.run(posts('a', 'b', 'c')));

    for (let i = 0; i < 3; i++) {
      s.tick();
      expect(s.api.pending().length).toBe(1);
      expect(batch.inFlight()).toBe(1);
      s.tick(10);
    }

    expect(result.value?.ok).toBe(true);
    expect(s.api.requests.map((r) => r.path)).toEqual(['/posts/a', '/posts/b', '/posts/c']);

    c.destroy();
  });

  it('reports every outcome in input order even when the requests settle out of order', () => {
    const s = scenario();
    const delays: Record<string, number> = { '1': 300, '2': 10, '3': 100 };
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({
      body: { id: params['id'], archived: true },
      delay: delays[params['id'] as string],
    }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id }, body: { archived: true } }),
      }),
    );

    const result = capture(batch.run(posts('1', '2', '3')));
    s.tick();
    s.tick(10);

    expect(batch.results().map((r) => r.index)).toEqual([1]);

    s.tick(90);

    expect(batch.results().map((r) => r.index)).toEqual([1, 2]);
    expect(batch.completed()).toBe(2);

    s.tick(200);

    expect(result.value?.results.map((r) => r.index)).toEqual([0, 1, 2]);
    expect(ids(result.value?.succeeded ?? [])).toEqual(['1', '2', '3']);
    expect(result.value?.succeeded[0]).toEqual({
      status: 'success',
      index: 0,
      item: { id: '1' },
      args: { pathParams: { id: '1' }, body: { archived: true } },
      response: { id: '1', archived: true },
    });

    c.destroy();
  });

  it('records an item whose args return null as skipped, sends nothing for it and keeps ok true', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => (post.id === '2' ? null : { pathParams: { id: post.id } }),
      }),
    );

    const result = capture(batch.run(posts('1', '2', '3')));
    s.flush();

    expect(result.value?.ok).toBe(true);
    expect(result.value?.skipped).toEqual([{ status: 'skipped', index: 1, item: { id: '2' } }]);
    expect(result.value?.failed).toEqual([]);
    expect(ids(result.value?.succeeded ?? [])).toEqual(['1', '3']);
    expect(batch.skipped()).toBe(1);
    expect(batch.completed()).toBe(3);
    expect(batch.progress()).toBe(100);
    expect(batch.status()).toBe('success');
    expect(s.api.requestCount('PATCH', '/posts/2')).toBe(0);

    c.destroy();
  });

  it('keeps going after a failure by default and reports the failure with its item, index and error', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/2', () => ({ status: 409, body: { message: 'conflict' } }));
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 1,
      }),
    );

    const result = capture(batch.run(posts('1', '2', '3')));
    s.flush();

    expect(result.value?.ok).toBe(false);
    expect(result.value?.cancelled).toBe(false);
    expect(result.value?.failed.length).toBe(1);
    expect(result.value?.failed[0]).toMatchObject({ status: 'error', index: 1, item: { id: '2' } });
    expect(result.value?.failed[0]?.error.code).toBe(409);
    expect(ids(result.value?.succeeded ?? [])).toEqual(['1', '3']);
    expect(batch.status()).toBe('partial');
    expect(batch.failed()).toBe(1);
    expect(batch.failedItems()).toEqual([{ id: '2' }]);
    expect(batch.errors().map((e) => e.code)).toEqual([409]);
    expect(s.api.requestCount('PATCH', '/posts/3')).toBe(1);

    s.expectError(httpStatusError(409));
    c.destroy();
  });

  it('ends with status error when no item succeeded', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', () => ({ status: 500, body: { message: 'down' } }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({ queryCreator: patchPosts(s), args: (post: Post) => ({ pathParams: { id: post.id } }) }),
    );

    const result = capture(batch.run(posts('1', '2')));
    s.flush();

    expect(result.value?.ok).toBe(false);
    expect(result.value?.failed.length).toBe(2);
    expect(batch.status()).toBe('error');

    s.expectError(httpStatusError(500));
    s.expectError(httpStatusError(500));
    c.destroy();
  });

  it('stopOnError leaves the in-flight requests to settle and marks the queue as not attempted', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/1', () => ({ status: 500, body: { message: 'boom' }, delay: 10 }));
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 2,
        stopOnError: true,
      }),
    );

    const result = capture(batch.run(posts('1', '2', '3', '4')));
    s.tick();
    s.tick(10);

    expect(batch.failed()).toBe(1);
    expect(s.api.pending().length).toBe(1);
    expect(s.api.requestCount('PATCH', '/posts/3')).toBe(0);

    s.tick(90);

    expect(result.value?.cancelled).toBe(true);
    expect(result.value?.ok).toBe(false);
    expect(ids(result.value?.failed ?? [])).toEqual(['1']);
    expect(ids(result.value?.succeeded ?? [])).toEqual(['2']);
    expect(ids(result.value?.notAttempted ?? [])).toEqual(['3', '4']);
    expect(result.value?.results.map((r) => r.status)).toEqual(['error', 'success', 'cancelled', 'cancelled']);
    expect(batch.status()).toBe('partial');
    expect(batch.completed()).toBe(4);
    expect(s.api.requests.length).toBe(2);

    s.expectError(httpStatusError(500));
    c.destroy();
  });

  it('cancel() without a failure ends with status cancelled, and retryFailed() sends only what was left', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 2,
      }),
    );

    const first = capture(batch.run(posts('1', '2', '3', '4')));
    s.tick();
    batch.cancel();
    s.tick(100);

    expect(first.value?.cancelled).toBe(true);
    expect(ids(first.value?.notAttempted ?? [])).toEqual(['3', '4']);
    expect(batch.status()).toBe('cancelled');

    const retry = capture(batch.retryFailed());
    s.tick();

    expect(batch.status()).toBe('running');
    expect(batch.total()).toBe(4);
    expect(s.api.pending().map((r) => r.path)).toEqual(['/posts/3', '/posts/4']);

    s.tick(100);

    expect(retry.value?.ok).toBe(true);
    expect(retry.value?.cancelled).toBe(false);
    expect(retry.value?.results.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    expect(ids(retry.value?.succeeded ?? [])).toEqual(['1', '2', '3', '4']);
    expect(batch.status()).toBe('success');
    expect(batch.progress()).toBe(100);
    expect(s.api.requestCount('PATCH', '/posts/1')).toBe(1);
    expect(s.api.requestCount('PATCH', '/posts/2')).toBe(1);

    c.destroy();
  });

  it('retryFailed() never resends a successful item and clears the errors it recovers from', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/2', sequence([{ status: 500, body: { message: 'boom' } }, { body: { id: '2' } }]));
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({ queryCreator: patchPosts(s), args: (post: Post) => ({ pathParams: { id: post.id } }) }),
    );

    capture(batch.run(posts('1', '2', '3')));
    s.flush();

    expect(batch.failedItems()).toEqual([{ id: '2' }]);
    expect(batch.errors().length).toBe(1);

    const retry = capture(batch.retryFailed());
    s.flush();

    expect(retry.value?.ok).toBe(true);
    expect(retry.value?.failed).toEqual([]);
    expect(batch.errors()).toEqual([]);
    expect(batch.failedItems()).toEqual([]);
    expect(batch.failed()).toBe(0);
    expect(batch.succeeded()).toBe(3);
    expect(s.api.requestCount('PATCH', '/posts/1')).toBe(1);
    expect(s.api.requestCount('PATCH', '/posts/2')).toBe(2);
    expect(s.api.requestCount('PATCH', '/posts/3')).toBe(1);

    s.expectError(httpStatusError(500));
    c.destroy();
  });

  it('a second run() or retryFailed() while one is in flight errors with ET910 and leaves the first run alone', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({ queryCreator: patchPosts(s), args: (post: Post) => ({ pathParams: { id: post.id } }) }),
    );

    const first = capture(batch.run(posts('1', '2')));
    s.tick();

    const second = capture(batch.run(posts('3')));
    const retry = capture(batch.retryFailed());
    s.tick();

    expect(String(second.error)).toMatch(/ET910|already running/);
    expect(String(retry.error)).toMatch(/ET910|already running/);
    expect(batch.running()).toBe(true);
    expect(batch.total()).toBe(2);
    expect(s.api.requestCount('PATCH', '/posts/3')).toBe(0);

    s.tick(100);

    expect(first.value?.ok).toBe(true);
    expect(ids(first.value?.succeeded ?? [])).toEqual(['1', '2']);

    c.destroy();
  });

  it('rejects the withArgs feature with ET911', () => {
    const s = scenario();

    const c = s.consumer();

    expect(() =>
      c.run(() =>
        createQueryBatch({
          queryCreator: patchPosts(s),
          args: (post: Post) => ({ pathParams: { id: post.id } }),
          features: [withArgs(() => ({ pathParams: { id: 'x' } }))],
        }),
      ),
    ).toThrow(/ET911|withArgs/);

    c.destroy();
  });

  it('calls onItemSettled once per item, in settle order, before the run emits', () => {
    const s = scenario();
    const delays: Record<string, number> = { '1': 100, '2': 10, '3': 50 };
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({
      body: { id: params['id'] },
      delay: delays[params['id'] as string],
    }));

    const settledBeforeEmit: string[] = [];
    let emitted = false;
    const onItemSettled = vi.fn((result: QueryBatchItemResult<Post, PatchPostArgs>) => {
      settledBeforeEmit.push(`${result.item.id}:${result.status}:${emitted}`);
    });

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => (post.id === '4' ? null : { pathParams: { id: post.id } }),
        onItemSettled,
      }),
    );

    batch.run(posts('1', '2', '3', '4')).subscribe(() => (emitted = true));
    s.flush();

    expect(emitted).toBe(true);
    expect(onItemSettled).toHaveBeenCalledTimes(4);
    expect(settledBeforeEmit).toEqual(['4:skipped:false', '2:success:false', '3:success:false', '1:success:false']);

    c.destroy();
  });

  it('measures throughput only after the first wave has settled and the run is two seconds old', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 1000 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 2,
      }),
    );

    const result = capture(batch.run(posts('1', '2', '3', '4', '5', '6')));
    s.tick();

    expect(batch.itemsPerSecond()).toBeNull();
    expect(batch.remainingTime()).toBeNull();

    s.tick(1000);

    expect(batch.completed()).toBe(2);
    expect(batch.itemsPerSecond()).toBeNull();
    expect(batch.remainingTime()).toBeNull();

    s.tick(1000);

    expect(batch.completed()).toBe(4);
    expect(batch.itemsPerSecond()).toBe(2);
    expect(batch.remainingTime()).toBe(1000);

    s.tick(1000);

    expect(result.value?.ok).toBe(true);
    expect(batch.itemsPerSecond()).toBe(2);
    expect(batch.remainingTime()).toBeNull();

    c.destroy();
  });

  it('destroying the host mid-run stops the run, aborts its requests and settles the result as cancelled', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 2,
      }),
    );

    const result = capture(batch.run(posts('1', '2', '3', '4')));
    s.tick();
    s.tick(100);

    expect(batch.completed()).toBe(2);
    expect(s.api.pending().length).toBe(2);

    c.destroy();

    expect(s.api.pending().length).toBe(0);
    expect(batch.running()).toBe(false);
    expect(result.value?.cancelled).toBe(true);
    expect(ids(result.value?.succeeded ?? [])).toEqual(['1', '2']);
    expect(ids(result.value?.notAttempted ?? [])).toEqual(['3', '4']);

    s.tick(100);

    expect(s.api.requests.length).toBe(4);
  });

  it('reset() clears a settled run and is ignored while a run is in flight', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({ queryCreator: patchPosts(s), args: (post: Post) => ({ pathParams: { id: post.id } }) }),
    );

    capture(batch.run(posts('1')));
    s.tick();
    batch.reset();

    expect(batch.status()).toBe('running');
    expect(batch.total()).toBe(1);

    s.tick(100);

    expect(batch.status()).toBe('success');

    batch.reset();

    expect(batch.status()).toBe('idle');
    expect(batch.total()).toBe(0);
    expect(batch.results()).toEqual([]);
    expect(batch.progress()).toBe(0);
    expect(batch.itemsPerSecond()).toBeNull();

    c.destroy();
  });

  it('a sequence exposes completed() and progress() that advance one step at a time and stop at a failure', async () => {
    const s = scenario();
    s.api.on('POST', '/orders', () => ({ body: { id: 'order-1' } }));
    s.api.on('POST', '/payments', () => ({ status: 402, body: { message: 'declined' } }));
    s.api.on('POST', '/confirm', () => ({ body: { confirmed: true } }));

    const createOrder = s.post<{ response: { id: string } }>('/orders');
    const createPayment = s.post<{ response: { id: string }; body: { orderId: string } }>('/payments');
    const confirmOrder = s.post<{ response: { confirmed: boolean } }>('/confirm');

    const c = s.consumer();
    const checkout = c.run(() =>
      querySequence(createOrder(), () => ({ args: {} }))
        .then(createPayment(), (order) => ({ args: { body: { orderId: order.id } } }))
        .then(confirmOrder(), () => ({ args: {} })),
    );

    expect(checkout.completed()).toBe(0);
    expect(checkout.progress()).toBe(0);

    let result: Awaited<ReturnType<typeof checkout.run>> | undefined;
    checkout.run().then((r) => (result = r));

    for (let i = 0; i < 40 && result === undefined; i++) {
      await s.settle(10);
    }

    expect(result?.ok).toBe(false);
    expect(checkout.running()).toBe(false);
    expect(checkout.completed()).toBe(2);
    expect(checkout.progress()).toBeCloseTo((2 / 3) * 100);
    expect(s.api.requestCount('POST', '/confirm')).toBe(0);

    s.expectError(httpStatusError(402));
    c.destroy();
  });

  it('keeps inFlight balanced when a batch item throws on execute', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const patchPost = s.patch<{ response: { id: string }; pathParams: { id: string } }>((p) => {
      if (p.id === '2') throw new Error('no route for this item');

      return `/posts/${p.id}`;
    });

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({ queryCreator: patchPost, args: (post: Post) => ({ pathParams: { id: post.id } }) }),
    );

    const result = capture(batch.run(posts('1', '2', '3')));
    s.flush();

    expect(batch.inFlight()).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.value?.ok).toBe(false);
    expect(result.value?.failed.length).toBe(1);
    expect(result.value?.failed[0]).toMatchObject({ status: 'error', index: 1, item: { id: '2' } });
    expect(queryErrorMessage(result.value?.failed[0]?.error)).toBe('no route for this item');
    expect(ids(result.value?.succeeded ?? [])).toEqual(['1', '3']);
    expect(batch.status()).toBe('partial');
    expect(batch.running()).toBe(false);
    expect(batch.inFlight()).toBe(0);
    expect(batch.completed()).toBe(3);
    expect(s.api.requestCount('PATCH', '/posts/2')).toBe(0);

    c.destroy();
  });

  it('sends nothing until the run observable is subscribed to', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({ queryCreator: patchPosts(s), args: (post: Post) => ({ pathParams: { id: post.id } }) }),
    );

    const run$ = batch.run(posts('1', '2'));
    s.tick(1000);

    expect(s.api.requests.length).toBe(0);
    expect(batch.status()).toBe('idle');
    expect(batch.running()).toBe(false);
    expect(batch.total()).toBe(0);

    const result = capture(run$);
    s.tick();

    expect(batch.running()).toBe(true);
    expect(s.api.requests.map((r) => r.path)).toEqual(['/posts/1', '/posts/2']);

    s.tick(100);

    expect(result.value?.ok).toBe(true);

    c.destroy();
  });

  it('emits one result and completes when the run settles', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({ queryCreator: patchPosts(s), args: (post: Post) => ({ pathParams: { id: post.id } }) }),
    );

    const emissions: QueryBatchResult<Post, PatchPostArgs>[] = [];
    let completed = false;

    batch
      .run(posts('1', '2'))
      .subscribe({ next: (value) => emissions.push(value), complete: () => (completed = true) });
    s.tick();

    expect(emissions).toEqual([]);
    expect(completed).toBe(false);

    s.tick(100);

    expect(emissions.length).toBe(1);
    expect(emissions[0]?.ok).toBe(true);
    expect(completed).toBe(true);

    s.tick(1000);

    expect(emissions.length).toBe(1);

    c.destroy();
  });

  it('carries the resolved args on every succeeded and failed entry', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/2', () => ({ status: 400, body: { message: 'invalid' } }));
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post, index: number) => ({ pathParams: { id: post.id }, body: { archived: index % 2 === 0 } }),
        concurrency: 1,
      }),
    );

    const result = capture(batch.run(posts('1', '2', '3')));
    s.flush();

    expect(result.value?.succeeded.map((entry) => entry.args)).toEqual([
      { pathParams: { id: '1' }, body: { archived: true } },
      { pathParams: { id: '3' }, body: { archived: true } },
    ]);
    expect(result.value?.failed.map((entry) => entry.args)).toEqual([
      { pathParams: { id: '2' }, body: { archived: false } },
    ]);
    expect(batch.results().map((entry) => ('args' in entry ? entry.args : null))).toEqual([
      { pathParams: { id: '1' }, body: { archived: true } },
      { pathParams: { id: '2' }, body: { archived: false } },
      { pathParams: { id: '3' }, body: { archived: true } },
    ]);

    s.expectError(httpStatusError(400));
    c.destroy();
  });

  it('grows results() wave by wave while the run is still in flight', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 2,
      }),
    );

    const result = capture(batch.run(posts('1', '2', '3', '4', '5', '6')));
    s.tick();

    expect(batch.results()).toEqual([]);
    expect(batch.running()).toBe(true);

    s.tick(100);

    expect(batch.results().map((r) => r.index)).toEqual([0, 1]);
    expect(batch.results()[0]).toEqual({
      status: 'success',
      index: 0,
      item: { id: '1' },
      args: { pathParams: { id: '1' } },
      response: { id: '1' },
    });

    s.tick(100);

    expect(batch.results().map((r) => r.index)).toEqual([0, 1, 2, 3]);
    expect(batch.running()).toBe(true);

    s.tick(100);

    expect(batch.results().map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.value?.results.length).toBe(6);

    c.destroy();
  });

  it('holds remainingTime() steady between two settled items instead of counting down', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 1000 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 2,
      }),
    );

    const result = capture(batch.run(posts('1', '2', '3', '4', '5', '6')));
    s.tick();
    s.tick(1000);
    s.tick(1000);

    expect(batch.completed()).toBe(4);
    expect(batch.itemsPerSecond()).toBe(2);
    expect(batch.remainingTime()).toBe(1000);

    s.tick(500);

    expect(batch.completed()).toBe(4);
    expect(batch.itemsPerSecond()).toBe(2);
    expect(batch.remainingTime()).toBe(1000);

    s.tick(400);

    expect(batch.completed()).toBe(4);
    expect(batch.remainingTime()).toBe(1000);

    s.tick(100);

    expect(result.value?.ok).toBe(true);
    expect(batch.remainingTime()).toBeNull();

    c.destroy();
  });

  it('counts a skipped item as settled in the throughput estimate', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 2500 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => (post.id.startsWith('skip') ? null : { pathParams: { id: post.id } }),
        concurrency: 2,
      }),
    );

    const result = capture(batch.run(posts('skip-1', 'skip-2', 'skip-3', 'skip-4', '1', '2', '3', '4')));
    s.tick();

    expect(batch.skipped()).toBe(4);
    expect(batch.completed()).toBe(4);
    expect(batch.inFlight()).toBe(2);

    s.tick(2400);

    expect(batch.completed()).toBe(4);
    expect(s.api.pending().length).toBe(2);

    s.tick(100);

    expect(batch.completed()).toBe(6);
    expect(batch.itemsPerSecond()).toBeCloseTo(2.4);
    expect(batch.remainingTime()).toBe(833);
    expect(s.api.pending().length).toBe(2);

    s.tick(2500);

    expect(result.value?.ok).toBe(true);
    expect(batch.skipped()).toBe(4);
    expect(batch.succeeded()).toBe(4);

    c.destroy();
  });
});

describe('batching scenario with the default retry policy', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withDefaultRetry({ jitter: 0 })],
  });

  it('an item still gets the per-request retries of the client, and the batch waits for them', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/2', sequence([{ status: 503, body: { message: 'busy' } }, { body: { id: '2' } }]));
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({ queryCreator: patchPosts(s), args: (post: Post) => ({ pathParams: { id: post.id } }) }),
    );

    const result = capture(batch.run(posts('1', '2', '3')));
    s.tick();
    s.tick(1);

    expect(batch.completed()).toBe(2);
    expect(batch.running()).toBe(true);
    expect(result.value).toBeUndefined();

    s.tick(2000);
    s.tick(1);

    expect(result.value?.ok).toBe(true);
    expect(batch.failed()).toBe(0);
    expect(s.api.requestCount('PATCH', '/posts/2')).toBe(2);

    c.destroy();
  });
});

describe('batching scenario with the devtools attached', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 }, providers: () => [provideQueryDevtools()] });

  beforeEach(() => clearQueryDevtoolsTombstones());

  const batchEntry = (batch: AnyQueryBatch) =>
    queryDevtoolsEntries().find(
      (entry) => entry.kind === 'query-batch' && (entry.handle as QueryBatchDevtoolsHandle).current === batch,
    );

  const itemEntries = (batch: AnyQueryBatch) =>
    queryDevtoolsEntries().filter((entry) => entry.meta.batch?.current === batch);

  const liveItemEntries = (batch: AnyQueryBatch) => itemEntries(batch).filter((entry) => !entry.destroyedAt);

  it('holds only concurrency item queries alive at a time across a long run', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    expect(isQueryDevtoolsEnabled()).toBe(true);

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 3,
      }),
    );

    const created = new Set<string>();
    const result = capture(batch.run(numbered(12)));

    for (let wave = 0; wave < 4; wave++) {
      s.tick();

      const live = liveItemEntries(batch);

      expect(live.length).toBe(3);
      expect(batch.inFlight()).toBe(3);

      for (const entry of live) created.add(entry.id);

      s.tick(100);
    }

    expect(result.value?.ok).toBe(true);
    expect(created.size).toBe(12);
    expect(liveItemEntries(batch).length).toBe(0);
    expect(itemEntries(batch).length).toBe(12);
    expect(itemEntries(batch).map((entry) => entry.meta.batchItemIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(itemEntries(batch).every((entry) => entry.kind === 'query')).toBe(true);

    c.destroy();
  });

  it('registers a batch with its concurrency, progress and throughput, and one recorded row per item', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/4', () => ({ status: 400, body: { message: 'invalid' }, delay: 1000 }));
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 1000 }));

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id }, body: { archived: true } }),
        concurrency: 2,
      }),
    );

    const entry = batchEntry(batch);

    expect(entry?.meta).toMatchObject({ method: 'PATCH', route: '/posts/:id', concurrency: 2, stopOnError: false });

    const handle = entry?.handle as QueryBatchDevtoolsHandle;

    expect(handle.current).toBe(batch);
    expect(handle.current.status()).toBe('idle');

    const result = capture(batch.run(posts('1', '2', '3', '4', '5', '6')));
    s.tick();

    expect(handle.current.status()).toBe('running');
    expect(handle.current.total()).toBe(6);

    s.tick(1000);
    s.tick(1000);

    expect(handle.current.progress()).toBeCloseTo((4 / 6) * 100);
    expect(handle.current.itemsPerSecond()).toBe(2);
    expect(handle.current.remainingTime()).toBe(1000);

    s.tick(1000);

    expect(result.value?.ok).toBe(false);
    expect(handle.current.status()).toBe('partial');
    expect(handle.current.progress()).toBe(100);
    expect(handle.current.remainingTime()).toBeNull();
    expect(handle.current.results().map((r: QueryBatchItemResult<Post, PatchPostArgs>) => r.status)).toEqual([
      'success',
      'success',
      'success',
      'error',
      'success',
      'success',
    ]);
    expect(handle.current.results()[3]).toMatchObject({
      index: 3,
      item: { id: '4' },
      args: { pathParams: { id: '4' }, body: { archived: true } },
    });
    expect(handle.current.errors().map((e: { code: number | null }) => e.code)).toEqual([400]);

    s.expectError(httpStatusError(400));
    c.destroy();
  });

  it('keeps the batch-recorded args and outcome for an item whose query tail has rolled off', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const count = MAX_QUERY_BATCH_TOMBSTONES + 5;

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 1,
      }),
    );

    const result = capture(batch.run(numbered(count)));
    s.flush();

    expect(result.value?.ok).toBe(true);

    const kept = itemEntries(batch);

    expect(kept.length).toBe(MAX_QUERY_BATCH_TOMBSTONES);
    expect(kept.every((e) => !!e.destroyedAt)).toBe(true);
    expect(kept.map((e) => e.meta.batchItemIndex)).toEqual(
      Array.from({ length: MAX_QUERY_BATCH_TOMBSTONES }, (_, i) => i + (count - MAX_QUERY_BATCH_TOMBSTONES)),
    );

    expect(batch.results().length).toBe(count);
    expect(batch.results()[0]).toEqual({
      status: 'success',
      index: 0,
      item: { id: '1' },
      args: { pathParams: { id: '1' } },
      response: { id: '1' },
    });

    c.destroy();
  });

  it('folds a run into one Queries row and caps its tombstones per batch', () => {
    const s = scenario();
    s.api.on('GET', '/bystander', () => ({ body: { ok: true } }));
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const bystanderHost = s.consumer();
    const bystander = bystanderHost.run(() => s.get<{ response: { ok: boolean } }>('/bystander')(withArgs(() => ({}))));
    s.flush();

    expect(bystander.response()).toEqual({ ok: true });

    bystanderHost.destroy();

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPosts(s),
        args: (post: Post) => ({ pathParams: { id: post.id } }),
        concurrency: 1,
      }),
    );

    const result = capture(batch.run(numbered(MAX_QUERY_BATCH_TOMBSTONES + 5)));
    s.flush();

    expect(result.value?.ok).toBe(true);

    const entry = batchEntry(batch);
    const items = itemEntries(batch);

    expect(items.length).toBe(MAX_QUERY_BATCH_TOMBSTONES);
    expect(items.every((e) => e.meta.batch === (entry?.handle as QueryBatchDevtoolsHandle))).toBe(true);
    expect(new Set(items.map((e) => e.meta.batchItemIndex)).size).toBe(items.length);
    expect(queryDevtoolsEntries().filter((e) => e.kind === 'query-batch').length).toBe(1);
    expect(queryDevtoolsEntries().some((e) => e.meta.route === '/bystander' && !!e.destroyedAt)).toBe(true);

    c.destroy();
  });
});
