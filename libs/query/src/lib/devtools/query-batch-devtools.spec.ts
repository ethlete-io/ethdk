import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createQuery } from '../http/query';
import { createQueryBatch, QueryBatch, QueryBatchResult } from '../http/query-batch';
import { createQueryClient } from '../http/query-client';
import { createPatchQuery } from '../http/query-creator-templates';
import { QueryDevtoolsEntry } from './query-devtools-hook';
import { provideQueryDevtools, queryDevtoolsEntries } from './query-devtools-registry';
import { MAX_QUERY_BATCH_TOMBSTONES } from './query-devtools-tombstone';

type UpdatePostArgs = {
  pathParams: { id: number };
  body: { archived: boolean };
  response: { id: number; archived: boolean };
};

type Post = { id: number };

describe('query batch devtools instrumentation', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'batch-devtools-test' });

  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideQueryDevtools()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

  const tick = async () => {
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
  };

  const patchPost = createPatchQuery(client)<UpdatePostArgs>((p) => `/posts/${p.id}`);

  const makeBatch = (concurrency = 2) =>
    TestBed.runInInjectionContext(() =>
      createQueryBatch({
        queryCreator: patchPost,
        args: (post: Post) => ({ pathParams: { id: post.id }, body: { archived: true } }),
        concurrency,
      }),
    );

  const posts = (count: number): Post[] => Array.from({ length: count }, (_, i) => ({ id: i + 1 }));

  const flushPost = (id: number) =>
    httpTesting.expectOne(`https://example.com/posts/${id}`).flush({ id, archived: true });

  const start = (run$: Observable<QueryBatchResult<Post, UpdatePostArgs>>) => run$.subscribe();

  const batchEntries = () => queryDevtoolsEntries().filter((entry) => entry.kind === 'query-batch');

  const entryOf = (batch: QueryBatch<Post, UpdatePostArgs>): QueryDevtoolsEntry => {
    const entry = batchEntries().find((e) => (e.handle as { current: unknown }).current === batch);

    if (!entry) throw new Error('the batch was not registered');

    return entry;
  };

  const itemEntries = (batch: QueryBatch<Post, UpdatePostArgs>) =>
    queryDevtoolsEntries().filter((entry) => entry.meta.batch?.current === batch);

  it('registers one entry per batch, describing the query it runs per item', () => {
    const batch = makeBatch(6);
    const entry = entryOf(batch);

    expect(entry.meta).toMatchObject({
      clientName: 'batch-devtools-test',
      method: 'PATCH',
      route: '/posts/:id',
      concurrency: 6,
      stopOnError: false,
    });
  });

  it('exposes the live batch through the entry handle', async () => {
    const batch = makeBatch();
    const entry = entryOf(batch);
    const handle = entry.handle as { current: QueryBatch<Post, UpdatePostArgs> };

    start(batch.run(posts(2)));
    await tick();

    expect(handle.current.status()).toBe('running');
    expect(handle.current.total()).toBe(2);

    flushPost(1);
    flushPost(2);
    await tick();

    expect(handle.current.status()).toBe('success');
    expect(handle.current.progress()).toBe(100);
  });

  it('attributes every item query to the batch that created it', async () => {
    const batch = makeBatch();

    start(batch.run(posts(2)));
    await tick();

    const items = itemEntries(batch);

    expect(items).toHaveLength(2);
    expect(items.every((entry) => entry.kind === 'query')).toBe(true);
    expect(items.map((entry) => entry.meta.method)).toEqual(['PATCH', 'PATCH']);

    flushPost(1);
    flushPost(2);
    await tick();
  });

  it('keeps a settled item as a tombstone, so a finished run is still in the queries list', async () => {
    const batch = makeBatch();

    start(batch.run(posts(2)));
    await tick();
    flushPost(1);
    flushPost(2);
    await tick();

    const items = itemEntries(batch);

    expect(items).toHaveLength(2);
    expect(items.every((entry) => !!entry.destroyedAt)).toBe(true);
  });

  it('caps a batch tail per batch, so a bulk run cannot evict the other tombstones', async () => {
    const batch = makeBatch(1);
    const count = MAX_QUERY_BATCH_TOMBSTONES + 5;

    // A tombstone of its own, registered before the run, that the run must not push out.
    const bystander = TestBed.runInInjectionContext(() =>
      createQuery({ creatorInternals: { client, method: 'GET', route: '/bystander' }, features: [], queryConfig: {} }),
    );
    httpTesting.expectOne('https://example.com/bystander').flush({});
    bystander.subtle.destroy();

    start(batch.run(posts(count)));

    for (let id = 1; id <= count; id++) {
      await tick();
      flushPost(id);
    }

    await tick();

    expect(itemEntries(batch)).toHaveLength(MAX_QUERY_BATCH_TOMBSTONES);
    expect(queryDevtoolsEntries().some((entry) => entry.meta.route === '/bystander')).toBe(true);
  });

  it('unregisters the batch when its host is destroyed', () => {
    const batch = makeBatch();

    expect(batchEntries().some((e) => (e.handle as { current: unknown }).current === batch)).toBe(true);

    TestBed.resetTestingModule();

    expect(batchEntries().some((e) => (e.handle as { current: unknown }).current === batch)).toBe(false);
  });

  it('does not attribute a query created outside a batch', () => {
    const batch = makeBatch();
    const query = TestBed.runInInjectionContext(() => patchPost({ silenceMissingWithArgsFeatureError: true }));
    const entry = queryDevtoolsEntries().find((e) => e.handle === query);

    expect(entry?.meta.batch).toBeUndefined();
    expect(itemEntries(batch)).toEqual([]);
  });
});
