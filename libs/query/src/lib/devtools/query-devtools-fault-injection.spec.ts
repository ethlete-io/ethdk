import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQuery } from '../http/query';
import { withDefaultRetry } from '../http/query-client-features';
import { createQueryClient, QueryClientRef } from '../http/query-client';
import { clearQueryDevtoolsFaults, setQueryDevtoolsFault } from './query-devtools-faults';
import { QueryDevtoolsStats } from './query-devtools-stats';
import { queryDevtoolsEntries, provideQueryDevtools } from './query-devtools-registry';

describe('query devtools fault injection', () => {
  let client: QueryClientRef;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();

    client = createQueryClient({
      baseUrl: 'https://api.example.com',
      name: 'fault-test',
      features: [withDefaultRetry()],
    });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideQueryDevtools()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    clearQueryDevtoolsFaults();
    vi.useRealTimers();
  });

  const makeQuery = () =>
    TestBed.runInInjectionContext(() =>
      createQuery({
        creatorInternals: { client, method: 'GET', route: '/test' },
        features: [],
        queryConfig: {},
      }),
    );

  it('should not reach the network at all while a request is armed to fail', () => {
    setQueryDevtoolsFault({ clientName: 'fault-test', patch: { failNext: 1, status: 400 } });

    const query = makeQuery();

    // 400 is not retryable, so the injected failure is the query's final state.
    vi.advanceTimersByTime(0);

    httpTesting.expectNone('https://api.example.com/test');
    expect(query.error()?.code).toBe(400);
  });

  it('should never settle an injected failure in the tick that started it', () => {
    setQueryDevtoolsFault({ clientName: 'fault-test', patch: { failNext: 1, status: 400 } });

    const query = makeQuery();

    expect(query.error()).toBeNull();
    expect(query.loading()).not.toBeNull();
  });

  it('should drive a real retry that then succeeds, the way a flaky server would', () => {
    setQueryDevtoolsFault({ clientName: 'fault-test', patch: { failNext: 1, status: 503 } });

    const query = makeQuery();

    vi.advanceTimersByTime(0);

    // The first attempt failed inside the pipeline, so the retry policy - not the panel - decides what
    // happens next: nothing is on the wire, and the request is sitting out its backoff.
    httpTesting.expectNone('https://api.example.com/test');
    expect(query.subtle.request()?.subtle.retryState()).toMatchObject({ attempt: 2, status: 503 });
    expect(query.error()).toBeNull();

    // The policy's backoff is jittered, so it says how long it is waiting rather than being assumed.
    vi.advanceTimersByTime(query.subtle.request()?.subtle.retryState()?.delayMs ?? 0);

    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });

    expect(query.response()).toEqual({ hello: 'world' });
    expect(query.subtle.request()?.subtle.attempts()).toBe(2);
    expect(query.error()).toBeNull();
  });

  it('should give up after the retry limit when every attempt is armed to fail', () => {
    setQueryDevtoolsFault({ clientName: 'fault-test', patch: { failRate: 100, status: 503 } });

    const query = makeQuery();

    // 4 attempts total: the policy stops once `retryCount > 3`.
    vi.advanceTimersByTime(30_000);

    httpTesting.expectNone('https://api.example.com/test');
    expect(query.error()?.code).toBe(503);
    expect(query.subtle.request()?.subtle.attempts()).toBe(4);
  });

  it('should delay an attempt by the injected latency before it reaches the network', () => {
    setQueryDevtoolsFault({ clientName: 'fault-test', patch: { latencyMs: 500 } });

    const query = makeQuery();

    httpTesting.expectNone('https://api.example.com/test');
    expect(query.loading()).not.toBeNull();

    vi.advanceTimersByTime(500);

    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });

    expect(query.response()).toEqual({ hello: 'world' });
  });

  it('should leave a client with nothing armed untouched', () => {
    setQueryDevtoolsFault({ clientName: 'another-client', patch: { failRate: 100 } });

    makeQuery();

    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });
  });

  describe('lastResponseWasFaulted', () => {
    const statsOf = (query: unknown): QueryDevtoolsStats => {
      const entry = queryDevtoolsEntries().find((e) => e.handle === query);

      if (!entry?.stats) throw new Error('the query was not registered with stats');

      return entry.stats.current();
    };

    it('should flag the run tampered when a non-retryable fault is the final outcome', () => {
      setQueryDevtoolsFault({ clientName: 'fault-test', patch: { failNext: 1, status: 400 } });

      const query = makeQuery();
      vi.advanceTimersByTime(0);

      expect(query.error()?.code).toBe(400);
      expect(statsOf(query).lastResponseWasFaulted).toBe(true);
    });

    it('should not flag a real server error as tampered', () => {
      const query = makeQuery();

      httpTesting.expectOne('https://api.example.com/test').flush(null, { status: 500, statusText: 'Server Error' });

      expect(statsOf(query).lastResponseWasFaulted).toBe(false);
    });

    it('should clear the flag once a later execution reaches a real response', () => {
      setQueryDevtoolsFault({ clientName: 'fault-test', patch: { failNext: 1, status: 400 } });

      const query = makeQuery();
      vi.advanceTimersByTime(0);

      expect(statsOf(query).lastResponseWasFaulted).toBe(true);

      clearQueryDevtoolsFaults();
      query.execute();
      httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });

      expect(query.response()).toEqual({ hello: 'world' });
      expect(statsOf(query).lastResponseWasFaulted).toBe(false);
    });

    it('should not flag anything for a client with nothing armed', () => {
      const query = makeQuery();

      httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });

      expect(statsOf(query).lastResponseWasFaulted).toBe(false);
    });
  });
});
