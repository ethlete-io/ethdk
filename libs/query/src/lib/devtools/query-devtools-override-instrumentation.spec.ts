import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQuery } from '../http/query';
import { createQueryClient, QueryClientRef } from '../http/query-client';
import { QueryDevtoolsOverridesRecorder } from './query-devtools-overrides';
import { queryDevtoolsEntries, provideQueryDevtools } from './query-devtools-registry';

describe('query devtools override instrumentation', () => {
  let client: QueryClientRef;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'overrides-test' });

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

  const overridesOf = (query: unknown): QueryDevtoolsOverridesRecorder => {
    const entry = queryDevtoolsEntries().find((e) => e.handle === query);

    if (!entry?.overrides) throw new Error('the query was not registered with an overrides handle');

    return entry.overrides;
  };

  it('should leave an untouched query unaffected', () => {
    const query = makeQuery();

    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });

    expect(query.response()).toEqual({ hello: 'world' });
  });

  it('should apply an armed override to the response as it settles', () => {
    const query = makeQuery();
    const overrides = overridesOf(query);

    overrides.arm({ type: 'set', path: ['hello'], value: 'overridden' });

    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });

    expect(query.response()).toEqual({ hello: 'overridden' });
  });

  it('should reapply the same override across a refetch that returns a different value', () => {
    const query = makeQuery();
    const overrides = overridesOf(query);

    overrides.arm({ type: 'set', path: ['hello'], value: 'overridden' });

    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });
    expect(query.response()).toEqual({ hello: 'overridden' });

    query.execute();
    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'a fresh value' });

    expect(query.response()).toEqual({ hello: 'overridden' });
  });

  it('should stop applying an override once cleared', () => {
    const query = makeQuery();
    const overrides = overridesOf(query);

    overrides.arm({ type: 'set', path: ['hello'], value: 'overridden' });
    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });

    overrides.clear(overrides.list()[0]!.id);

    query.execute();
    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world again' });

    expect(query.response()).toEqual({ hello: 'world again' });
  });

  it('should not affect a different query on the same client', () => {
    const query = makeQuery();
    const otherQuery = TestBed.runInInjectionContext(() =>
      createQuery({
        creatorInternals: { client, method: 'GET', route: '/other' },
        features: [],
        queryConfig: {},
      }),
    );

    const overrides = overridesOf(query);
    overrides.arm({ type: 'set', path: ['hello'], value: 'overridden' });

    httpTesting.expectOne('https://api.example.com/test').flush({ hello: 'world' });
    httpTesting.expectOne('https://api.example.com/other').flush({ hello: 'world' });

    expect(query.response()).toEqual({ hello: 'overridden' });
    expect(otherQuery.response()).toEqual({ hello: 'world' });
  });
});
