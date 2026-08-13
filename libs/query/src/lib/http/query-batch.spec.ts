import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPEED_BUFFER_TIME_IN_MS } from './http-request';
import { createQueryBatch, QueryBatchResult } from './query-batch';
import { createQueryClient } from './query-client';
import { createPatchQuery } from './query-creator-templates';

type UpdatePostArgs = {
  pathParams: { id: number };
  body: { archived: boolean };
  response: { id: number; archived: boolean };
};

type Post = { id: number };

describe('createQueryBatch', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'batch-test' });

  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

  /** Lets the batch issue the requests it can, and any settled item pull the next one off the queue. */
  const tick = async () => {
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
  };

  /** Subscribes eagerly and keeps the emitted result reachable while the test flushes requests. */
  const start = <T>(run$: Observable<QueryBatchResult<T, UpdatePostArgs>>) => {
    const emitted: QueryBatchResult<T, UpdatePostArgs>[] = [];
    const subscription = run$.subscribe((result) => emitted.push(result));

    return {
      get result() {
        expect(emitted).toHaveLength(1);

        return emitted[0] as QueryBatchResult<T, UpdatePostArgs>;
      },
      get settled() {
        return emitted.length === 1;
      },
      unsubscribe: () => subscription.unsubscribe(),
    };
  };

  const patchPost = createPatchQuery(client)<UpdatePostArgs>((p) => `/posts/${p.id}`);

  const makeBatch = (options?: { concurrency?: number; stopOnError?: boolean; skipEven?: boolean }) =>
    TestBed.runInInjectionContext(() =>
      createQueryBatch({
        queryCreator: patchPost,
        args: (post: Post) =>
          options?.skipEven && post.id % 2 === 0 ? null : { pathParams: { id: post.id }, body: { archived: true } },
        concurrency: options?.concurrency ?? 2,
        stopOnError: options?.stopOnError,
      }),
    );

  const posts = (count: number): Post[] => Array.from({ length: count }, (_, i) => ({ id: i + 1 }));

  const flushPost = (id: number, opts?: { status: number; statusText: string }) =>
    httpTesting
      .expectOne(`https://example.com/posts/${id}`)
      .flush(opts ? { detail: 'nope' } : { id, archived: true }, opts);

  it('starts idle', () => {
    const batch = makeBatch();

    expect(batch.status()).toBe('idle');
    expect(batch.running()).toBe(false);
    expect(batch.total()).toBe(0);
    expect(batch.progress()).toBe(0);
    expect(batch.results()).toEqual([]);
  });

  it('sends nothing until the run is subscribed to', async () => {
    const batch = makeBatch();

    batch.run(posts(2));
    await tick();

    expect(batch.running()).toBe(false);
    httpTesting.expectNone(() => true);
  });

  it('runs every item and reports success in input order', async () => {
    const batch = makeBatch({ concurrency: 3 });
    const run = start(batch.run(posts(3)));

    await tick();
    expect(batch.running()).toBe(true);
    expect(batch.total()).toBe(3);

    flushPost(2);
    flushPost(1);
    flushPost(3);
    await tick();

    expect(run.result.ok).toBe(true);
    expect(run.result.succeeded.map((r) => r.index)).toEqual([0, 1, 2]);
    expect(run.result.succeeded.map((r) => r.response.id)).toEqual([1, 2, 3]);
    expect(batch.status()).toBe('success');
    expect(batch.progress()).toBe(100);
    expect(batch.succeeded()).toBe(3);
  });

  it('never exceeds the configured concurrency', async () => {
    const batch = makeBatch({ concurrency: 2 });
    const run = start(batch.run(posts(5)));

    // `match()` consumes what it returns, so flush the batch it hands back rather than re-querying.
    const flushPending = async (expected: number) => {
      const pending = httpTesting.match(() => true);

      expect(pending).toHaveLength(expected);
      pending.forEach((request) => request.flush({ id: 1, archived: true }));
      await tick();
    };

    await tick();
    expect(batch.inFlight()).toBe(2);

    await flushPending(2);
    await flushPending(2);
    await flushPending(1);

    expect(run.result.succeeded).toHaveLength(5);
    expect(batch.inFlight()).toBe(0);
  });

  it('keeps going after a failure and records it against its item', async () => {
    const batch = makeBatch({ concurrency: 3 });
    const items = posts(3);
    const run = start(batch.run(items));

    await tick();
    flushPost(1);
    flushPost(2, { status: 422, statusText: 'Unprocessable Entity' });
    flushPost(3);
    await tick();

    expect(run.result.ok).toBe(false);
    expect(run.result.succeeded).toHaveLength(2);
    expect(run.result.failed).toHaveLength(1);
    expect(run.result.failed[0]?.item).toBe(items[1]);
    expect(run.result.failed[0]?.index).toBe(1);
    expect(run.result.failed[0]?.error.code).toBe(422);
    expect(batch.status()).toBe('partial');
    expect(batch.failedItems()).toEqual([items[1]]);
    expect(batch.errors()).toHaveLength(1);
  });

  it('reports "error" when every item failed', async () => {
    const batch = makeBatch({ concurrency: 2 });
    const run = start(batch.run(posts(2)));

    await tick();
    flushPost(1, { status: 500, statusText: 'Server Error' });
    flushPost(2, { status: 500, statusText: 'Server Error' });
    await tick();

    expect(run.settled).toBe(true);
    expect(batch.status()).toBe('error');
  });

  it('skips items whose args function returns null without sending a request', async () => {
    const batch = makeBatch({ concurrency: 4, skipEven: true });
    const run = start(batch.run(posts(4)));

    await tick();
    flushPost(1);
    flushPost(3);
    await tick();

    expect(run.result.ok).toBe(true);
    expect(run.result.skipped.map((r) => r.index)).toEqual([1, 3]);
    expect(batch.skipped()).toBe(2);
    expect(batch.completed()).toBe(4);
  });

  it('stops scheduling on the first error when stopOnError is set', async () => {
    const batch = makeBatch({ concurrency: 1, stopOnError: true });
    const run = start(batch.run(posts(4)));

    await tick();
    flushPost(1);
    await tick();
    flushPost(2, { status: 500, statusText: 'Server Error' });
    await tick();

    expect(run.result.cancelled).toBe(true);
    expect(run.result.succeeded).toHaveLength(1);
    expect(run.result.failed).toHaveLength(1);
    expect(run.result.notAttempted.map((r) => r.index)).toEqual([2, 3]);
    expect(batch.status()).toBe('partial');
  });

  it('cancel() stops the queue but lets in-flight requests settle', async () => {
    const batch = makeBatch({ concurrency: 2 });
    const run = start(batch.run(posts(6)));

    await tick();
    batch.cancel();
    flushPost(1);
    flushPost(2);
    await tick();

    expect(run.result.cancelled).toBe(true);
    expect(run.result.succeeded).toHaveLength(2);
    expect(run.result.notAttempted).toHaveLength(4);
    expect(batch.status()).toBe('cancelled');
  });

  it('retryFailed() re-sends only the items that did not succeed', async () => {
    const batch = makeBatch({ concurrency: 3 });
    const run = start(batch.run(posts(3)));

    await tick();
    flushPost(1);
    flushPost(2, { status: 500, statusText: 'Server Error' });
    flushPost(3);
    await tick();

    expect(run.settled).toBe(true);

    const retry = start(batch.retryFailed());

    await tick();
    flushPost(2);
    await tick();

    expect(retry.result.ok).toBe(true);
    expect(batch.succeeded()).toBe(3);
    expect(batch.failed()).toBe(0);
    expect(batch.status()).toBe('success');
    expect(batch.results().map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it('retryFailed() also picks up what a cancel left unattempted', async () => {
    const batch = makeBatch({ concurrency: 1 });
    const run = start(batch.run(posts(3)));

    await tick();
    batch.cancel();
    flushPost(1);
    await tick();

    expect(run.settled).toBe(true);
    expect(batch.completed()).toBe(3);

    const retry = start(batch.retryFailed());

    await tick();
    flushPost(2);
    await tick();
    flushPost(3);
    await tick();

    expect(retry.result.ok).toBe(true);
    expect(batch.succeeded()).toBe(3);
  });

  it('calls onItemSettled as each item lands', async () => {
    const onItemSettled = vi.fn();
    const batch = TestBed.runInInjectionContext(() =>
      createQueryBatch({
        queryCreator: patchPost,
        args: (post: Post) => ({ pathParams: { id: post.id }, body: { archived: true } }),
        concurrency: 2,
        onItemSettled,
      }),
    );

    const run = start(batch.run(posts(2)));

    await tick();
    flushPost(1);
    await tick();

    expect(onItemSettled).toHaveBeenCalledTimes(1);

    flushPost(2);
    await tick();

    expect(run.settled).toBe(true);
    expect(onItemSettled).toHaveBeenCalledTimes(2);
    expect(onItemSettled.mock.calls[0]?.[0]).toMatchObject({ status: 'success', index: 0 });
  });

  it('errors when a run is started while one is in flight', async () => {
    const batch = makeBatch({ concurrency: 1 });
    const run = start(batch.run(posts(2)));

    await tick();

    const errors: Error[] = [];
    batch.run(posts(2)).subscribe({ error: (error: Error) => errors.push(error) });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/already running/);

    flushPost(1);
    await tick();
    flushPost(2);
    await tick();

    expect(run.settled).toBe(true);
  });

  it('reset() clears the results once the run has settled', async () => {
    const batch = makeBatch({ concurrency: 1 });
    const run = start(batch.run(posts(1)));

    await tick();
    flushPost(1);
    await tick();

    expect(run.settled).toBe(true);

    batch.reset();

    expect(batch.status()).toBe('idle');
    expect(batch.total()).toBe(0);
    expect(batch.results()).toEqual([]);
  });

  it('settles an empty batch immediately', () => {
    const batch = makeBatch();
    const run = start(batch.run([]));

    expect(run.result.ok).toBe(true);
    expect(run.result.results).toEqual([]);
    expect(batch.status()).toBe('success');
    expect(batch.progress()).toBe(0);
  });

  describe('throughput and remaining time', () => {
    /** Only `Date.now()` is controlled - the harness itself flushes on real timers. */
    const useClock = (start: number) => {
      let now = start;

      vi.spyOn(Date, 'now').mockImplementation(() => now);

      return (advanceBy: number) => (now += advanceBy);
    };

    afterEach(() => vi.restoreAllMocks());

    /** Flushes everything in flight, all settling at the current mocked time. */
    const flushPending = async (expected: number) => {
      const pending = httpTesting.match(() => true);

      expect(pending).toHaveLength(expected);
      pending.forEach((request) => request.flush({ id: 1, archived: true }));
      await tick();
    };

    /** Settles the rest of a part-way run, so `httpTesting.verify()` has nothing left to report. */
    const drain = async (batch: { cancel: () => void }) => {
      batch.cancel();
      httpTesting.match(() => true).forEach((request) => request.flush({ id: 1, archived: true }));
      await tick();
    };

    it('reports nothing before the speed buffer has passed', async () => {
      const advance = useClock(1_000);
      const batch = makeBatch({ concurrency: 2 });
      const run = start(batch.run(posts(6)));

      await tick();
      advance(SPEED_BUFFER_TIME_IN_MS - 1);
      await flushPending(2);

      expect(batch.completed()).toBe(2);
      expect(batch.itemsPerSecond()).toBeNull();
      expect(batch.remainingTime()).toBeNull();

      await drain(batch);
      expect(run.settled).toBe(true);
    });

    it('estimates the remaining time from the throughput so far', async () => {
      const advance = useClock(1_000);
      const batch = makeBatch({ concurrency: 2 });
      const run = start(batch.run(posts(10)));

      await tick();
      advance(4_000);
      await flushPending(2);
      await flushPending(2);

      // 4 items in 4s, 6 left.
      expect(batch.completed()).toBe(4);
      expect(batch.itemsPerSecond()).toBe(1);
      expect(batch.remainingTime()).toBe(6_000);

      await drain(batch);
      expect(run.settled).toBe(true);
    });

    it('drops the estimate once nothing is outstanding', async () => {
      const advance = useClock(1_000);
      const batch = makeBatch({ concurrency: 2 });
      const run = start(batch.run(posts(4)));

      await tick();
      advance(4_000);
      await flushPending(2);
      await flushPending(2);

      expect(run.result.ok).toBe(true);
      expect(batch.itemsPerSecond()).toBe(1);
      expect(batch.remainingTime()).toBeNull();
    });

    it('measures a retry against the items that retry re-sends', async () => {
      const advance = useClock(1_000);
      const batch = makeBatch({ concurrency: 2 });
      const run = start(batch.run(posts(4)));

      await tick();
      advance(4_000);
      httpTesting
        .match(() => true)
        .forEach((request) => request.flush({ detail: 'nope' }, { status: 500, statusText: 'Server Error' }));
      await tick();
      httpTesting
        .match(() => true)
        .forEach((request) => request.flush({ detail: 'nope' }, { status: 500, statusText: 'Server Error' }));
      await tick();

      expect(run.result.failed).toHaveLength(4);

      const retry = start(batch.retryFailed());

      await tick();
      advance(2_000);
      await flushPending(2);

      // The 2 items this retry settled, not the 4 the first run did.
      expect(batch.itemsPerSecond()).toBe(1);
      expect(batch.remainingTime()).toBe(2_000);

      await drain(batch);
      expect(retry.settled).toBe(true);
    });

    it('reset() clears the estimate', async () => {
      const advance = useClock(1_000);
      const batch = makeBatch({ concurrency: 2 });

      start(batch.run(posts(4)));

      await tick();
      advance(4_000);
      await flushPending(2);
      await flushPending(2);

      batch.reset();

      expect(batch.itemsPerSecond()).toBeNull();
      expect(batch.remainingTime()).toBeNull();
    });
  });
});
