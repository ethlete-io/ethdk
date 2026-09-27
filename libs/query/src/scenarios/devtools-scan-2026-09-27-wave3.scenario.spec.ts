import { beforeEach, describe, expect, it } from 'vitest';
import {
  armQueryDevtoolsMock,
  clearQueryDevtoolsArmedMocks,
  clearQueryDevtoolsMockStore,
  clearQueryDevtoolsTombstones,
  createQueryBatch,
  isQueryDevtoolsEnabled,
  MAX_QUERY_BATCH_TOMBSTONE_BUCKETS,
  MAX_QUERY_BATCH_TOMBSTONES,
  provideQueryDevtools,
  queryDevtoolsEntries,
  queryDevtoolsMockId,
  saveQueryDevtoolsMock,
  withArgs,
} from '../index';
import { useScenario } from './harness';

describe('devtools scan 2026-09-27 wave 3: a mock on a client whose baseUrl has a path', () => {
  const CLIENT_NAME = 'devtools-wave3-versioned';
  const scenario = useScenario({
    name: CLIENT_NAME,
    baseUrl: 'https://api.test/v1',
    clientOptions: { keepUnusedFor: 0 },
    providers: () => [provideQueryDevtools()],
  });

  beforeEach(() => {
    clearQueryDevtoolsArmedMocks();
    clearQueryDevtoolsMockStore();
  });

  it('answers the route after the base path from the very first request, and nothing behind another prefix', async () => {
    const s = scenario();
    expect(isQueryDevtoolsEnabled()).toBe(true);

    const pattern = '/posts/:id';
    const id = queryDevtoolsMockId({ clientName: CLIENT_NAME, method: 'GET', pattern });

    saveQueryDevtoolsMock({
      id,
      clientName: CLIENT_NAME,
      method: 'GET',
      pattern,
      query: '',
      status: 200,
      body: { title: 'designed' },
      latencyMs: 0,
      capturedAt: null,
    });
    armQueryDevtoolsMock(id, true);

    s.api.on('GET', '/users/posts/:id', () => ({ body: { title: 'real' } }));

    const getPost = s.get<{ response: { title: string }; pathParams: { id: string } }>((p) => `/posts/${p.id}`);
    const getUserPost = s.get<{ response: { title: string }; pathParams: { id: string } }>(
      (p) => `/users/posts/${p.id}`,
    );
    const c = s.consumer();
    const mocked = c.run(() => getPost(withArgs(() => ({ pathParams: { id: '12' } }))));
    const real = c.run(() => getUserPost(withArgs(() => ({ pathParams: { id: '12' } }))));
    await s.settle();

    expect(mocked.response()).toEqual({ title: 'designed' });
    expect(real.response()).toEqual({ title: 'real' });
    expect(s.api.requests.map((request) => request.path)).toEqual(['/users/posts/12']);

    c.destroy();
  });
});

describe('devtools scan 2026-09-27 wave 3: batch item tombstones across many batches', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 }, providers: () => [provideQueryDevtools()] });

  beforeEach(() => clearQueryDevtoolsTombstones());

  it('keeps the tail of the most recently settled batches only', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const patchPost = s.patch<{ response: { id: string }; pathParams: { id: string } }>((p) => `/posts/${p.id}`);
    const c = s.consumer();
    const batches = Array.from({ length: MAX_QUERY_BATCH_TOMBSTONE_BUCKETS + 2 }, () =>
      c.run(() =>
        createQueryBatch({
          queryCreator: patchPost,
          args: (item: { id: string }) => ({ pathParams: { id: item.id } }),
          concurrency: 1,
        }),
      ),
    );

    batches.forEach((batch, index) => {
      batch.run([{ id: `${index}-a` }, { id: `${index}-b` }, { id: `${index}-c` }]).subscribe();
      s.flush();
    });

    const kept = batches.map(
      (batch) => queryDevtoolsEntries().filter((entry) => entry.meta.batch?.current === batch).length,
    );

    expect(kept).toEqual([0, 0, ...Array.from({ length: MAX_QUERY_BATCH_TOMBSTONE_BUCKETS }, () => 3)]);
    expect(kept.reduce((sum, count) => sum + count, 0)).toBeLessThanOrEqual(
      MAX_QUERY_BATCH_TOMBSTONE_BUCKETS * MAX_QUERY_BATCH_TOMBSTONES,
    );

    c.destroy();
  });
});
