import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQuery } from '../http/query';
import { createQueryClient, QueryClientRef } from '../http/query-client';
import { QueryDevtoolsStats } from './query-devtools-stats';
import { queryDevtoolsEntries, provideQueryDevtools } from './query-devtools-registry';

describe('query devtools stats instrumentation', () => {
  let client: QueryClientRef;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'stats-test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideQueryDevtools()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  const makeQuery = () =>
    TestBed.runInInjectionContext(() =>
      createQuery({
        creatorInternals: { client, method: 'GET', route: '/test' },
        features: [],
        queryConfig: {},
      }),
    );

  const statsOf = (query: unknown): QueryDevtoolsStats => {
    const entry = queryDevtoolsEntries().find((e) => e.handle === query);

    if (!entry?.stats) throw new Error('the query was not registered with stats');

    return entry.stats.current();
  };

  it('should count the request a query makes and the payload it received', () => {
    const query = makeQuery();

    httpTesting
      .expectOne('https://api.example.com/test')
      .flush({ hello: 'world' }, { headers: { 'content-length': '42' } });

    expect(statsOf(query)).toMatchObject({
      executions: 1,
      requests: 1,
      responses: 1,
      errors: 0,
      receivedBytes: 42,
      hasEstimatedBytes: false,
    });
  });

  it('should estimate the payload of a response without a content-length header', () => {
    const query = makeQuery();

    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });

    expect(statsOf(query)).toMatchObject({
      receivedBytes: JSON.stringify({ hello: 'world' }).length,
      hasEstimatedBytes: true,
    });
  });

  it('should count every refresh', () => {
    const query = makeQuery();

    httpTesting.expectOne('https://api.example.com/test').flush({}, { headers: { 'content-length': '2' } });
    query.execute();
    httpTesting.expectOne('https://api.example.com/test').flush({}, { headers: { 'content-length': '2' } });

    expect(statsOf(query)).toMatchObject({ executions: 2, requests: 2, responses: 2, receivedBytes: 4 });
  });

  it('should count a failed request apart from a response', () => {
    const query = makeQuery();

    httpTesting
      .expectOne('https://api.example.com/test')
      .flush({ message: 'nope' }, { status: 404, statusText: 'Not Found' });

    expect(statsOf(query)).toMatchObject({ executions: 1, requests: 1, responses: 0, errors: 1 });
  });

  it('should not count a request for an execution that reused the in-flight one', () => {
    const query = makeQuery();

    query.execute({ options: { allowCache: true } });

    httpTesting.expectOne('https://api.example.com/test').flush({}, { headers: { 'content-length': '2' } });

    expect(statsOf(query)).toMatchObject({ executions: 2, requests: 1, responses: 1 });
  });

  it('should clear an entry`s counters on reset', () => {
    const query = makeQuery();

    httpTesting.expectOne('https://api.example.com/test').flush({});

    const entry = queryDevtoolsEntries().find((e) => e.handle === query);
    entry?.stats?.reset();

    expect(statsOf(query)).toMatchObject({ executions: 0, requests: 0, responses: 0, receivedBytes: 0 });
  });
});
