import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AnyV2Query, QueryMockConfig, V2QueryClient, def } from '@ethlete/query';
import '../../../test-helpers';
import { queryButtonSourceFromV2Query } from './query-button-source-from-v2-query';
import { QueryButtonLoadingState, QueryButtonSource } from './query-button.directive';

type SaveResponse = { id: string };

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const flush = async () => {
  TestBed.tick();
  await settle();
  TestBed.tick();
  await settle();
};

const readLoading = (source: QueryButtonSource): Signal<QueryButtonLoadingState> => {
  if (!('loading' in source)) throw new Error('Expected a loading source');

  return source.loading;
};

describe('queryButtonSourceFromV2Query', () => {
  const client = new V2QueryClient({ baseRoute: 'https://api.test.com' });
  const savePost = client.post({
    route: '/posts',
    reportProgress: true,
    types: { args: def<{ body: { title: string } }>(), response: def<SaveResponse>() },
  });

  const prepare = (mock: QueryMockConfig<SaveResponse>) =>
    savePost.prepare({ body: { title: 'Hello' }, mock }) as unknown as AnyV2Query;

  const createSource = () => {
    const query = signal<AnyV2Query | null>(null);
    const loading = TestBed.runInInjectionContext(() => readLoading(queryButtonSourceFromV2Query(query)));

    return { query, loading };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('is idle without a query', async () => {
    const { loading } = createSource();

    await flush();

    expect(loading()).toBeNull();
  });

  it('is loading while the query runs and idle once it settles', async () => {
    const { query, loading } = createSource();
    const prepared = prepare({ delay: 50, response: { id: '1' } });

    query.set(prepared);
    prepared.execute();
    await flush();

    expect(loading()).toEqual({ progress: null });

    await vi.waitFor(() => {
      TestBed.tick();
      expect(loading()).toBeNull();
    });
  });

  it('maps the progress percentage', async () => {
    const { query, loading } = createSource();
    const prepared = prepare({ delay: 10, response: { id: '1' }, progress: { eventCount: 6, fileSize: 100 } });

    query.set(prepared);
    prepared.execute();

    await vi.waitFor(() => {
      TestBed.tick();
      const current = loading();
      const percentage = typeof current === 'object' ? current?.progress?.percentage : undefined;

      expect(percentage).toBeGreaterThan(0);
    });
  });
});
