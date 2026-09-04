import { HttpErrorResponse } from '@angular/common/http';
import { createQueryBatch, QueryBatchItemResult, querySequence, withArgs, withDefaultRetry } from '../index';
import { ObservedValueOf } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Scenario, sequence, useScenario } from './harness';

type Post = { id: string };

const posts = (...ids: string[]): Post[] => ids.map((id) => ({ id }));

const ids = (results: readonly { item: Post }[]) => results.map((r) => r.item.id);

const patchPosts = (s: Scenario) =>
  s.patch<{ response: { id: string }; pathParams: { id: string }; body?: { archived: boolean } }>(
    (p) => `/posts/${p.id}`,
  );

const capture = <T>(source: {
  subscribe: (observer: { next: (v: T) => void; error: (e: unknown) => void }) => unknown;
}) => {
  const holder: { value?: T; error?: unknown } = {};
  source.subscribe({ next: (v) => (holder.value = v), error: (e) => (holder.error = e) });

  return holder;
};

const httpStatusError = (status: number) => (entry: { error: unknown }) =>
  entry.error instanceof HttpErrorResponse && entry.error.status === status;

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
    const onItemSettled = vi.fn((result: QueryBatchItemResult<Post, never>) => {
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
