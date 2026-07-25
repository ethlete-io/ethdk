import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { createEnvironmentInjector, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createQuery } from './query';
import { createQueryClient, QueryClientRef } from './query-client';

describe('createQuery', () => {
  let client: QueryClientRef;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  const make = () =>
    TestBed.runInInjectionContext(() =>
      createQuery({
        creatorInternals: { client, method: 'GET', route: '/test' },
        features: [],
        queryConfig: {},
      }),
    );

  it('should create a query with all expected properties', () => {
    const query = make();
    expect(query.args).toBeDefined();
    expect(query.response).toBeDefined();
    expect(query.loading).toBeDefined();
    expect(query.error).toBeDefined();
    expect(query.execute).toBeDefined();
    expect(query.subtle).toBeDefined();
    expect(typeof query.asReadonly).toBe('function');
    expect(typeof query.reset).toBe('function');
  });

  it('asReadonly should return a query without mutating methods', () => {
    const ro = make().asReadonly();
    expect(ro.args).toBeDefined();
    expect(ro.response).toBeDefined();
    expect((ro as unknown as { execute: unknown }).execute).toBeUndefined();
    expect((ro as unknown as { subtle: unknown }).subtle).toBeUndefined();
  });
});

describe('createQuery — returning to a retained cache entry', () => {
  let client: QueryClientRef;
  let httpTesting: HttpTestingController;
  let parent: EnvironmentInjector;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'retention-test' });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });

    httpTesting = TestBed.inject(HttpTestingController);
    parent = TestBed.inject(EnvironmentInjector);
  });

  /** Stands in for a route component: its own injector, so destroying it unbinds the query. */
  const mountQuery = () => {
    const injector = createEnvironmentInjector([], parent);

    const query = runInInjectionContext(injector, () =>
      createQuery({
        creatorInternals: { client, method: 'GET', route: '/test' },
        features: [],
        queryConfig: {},
      }),
    );

    return { query, destroy: () => injector.destroy() };
  };

  const flushAll = (body: unknown) => {
    for (const req of httpTesting.match(() => true)) {
      req.flush(body);
    }

    TestBed.tick();
  };

  it('renders the previous response immediately while revalidating, instead of an empty loading state', () => {
    const first = mountQuery();
    first.query.execute();
    flushAll({ id: 1 });

    expect(first.query.response()).toEqual({ id: 1 });

    // The user leaves the page.
    first.destroy();

    // ...and comes back within the keepUnusedFor window.
    const second = mountQuery();
    second.query.execute();

    // No flush yet: this is the frame that used to render a bare loading state. The whole point of
    // retention is that the list already has its rows here, so its real height is available.
    expect(second.query.response()).toEqual({ id: 1 });
    expect(second.query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: true });

    // The background revalidation then replaces it.
    flushAll({ id: 2 });
    expect(second.query.response()).toEqual({ id: 2 });
    expect(second.query.executionState()).toMatchObject({ type: 'success' });
  });

  it('starts from scratch when the client opts out of retention', () => {
    const noRetentionClient = createQueryClient({
      baseUrl: 'https://api.example.com',
      name: 'retention-test-off',
      keepUnusedFor: 0,
    });

    const mount = () => {
      const injector = createEnvironmentInjector([], parent);

      const query = runInInjectionContext(injector, () =>
        createQuery({
          creatorInternals: { client: noRetentionClient, method: 'GET', route: '/test' },
          features: [],
          queryConfig: {},
        }),
      );

      return { query, destroy: () => injector.destroy() };
    };

    const first = mount();
    first.query.execute();
    flushAll({ id: 1 });
    first.destroy();

    const second = mount();
    second.query.execute();

    expect(second.query.response()).toBeNull();
    expect(second.query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: false });
  });
});
