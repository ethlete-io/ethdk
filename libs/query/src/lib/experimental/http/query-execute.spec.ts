import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QueryArgs, RequestArgs } from './query';
import { provideQueryClient, QueryClient } from './query-client';
import { createQueryClientConfig } from './query-client-config';
import { QueryDependencies, setupQueryDependencies } from './query-dependencies';
import { createExecuteFn, CreateQueryExecuteOptions } from './query-execute';
import { QueryState, setupQueryState } from './query-state';

describe('query execute', () => {
  const queryClientConfig = createQueryClientConfig({ baseUrl: 'https://example.com', name: 'test' });

  let args: RequestArgs<QueryArgs>;
  let deps: QueryDependencies;
  let state: QueryState<QueryArgs>;
  let executeOptions: CreateQueryExecuteOptions<QueryArgs>;
  let queryClient: QueryClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideQueryClient(queryClientConfig), provideHttpClient(), provideHttpClientTesting()],
    });

    queryClient = TestBed.inject(queryClientConfig.token);

    TestBed.runInInjectionContext(() => {
      args = { queryParams: { id: 1 } };
      deps = setupQueryDependencies({ clientConfig: queryClientConfig, queryConfig: {} });
      state = setupQueryState<QueryArgs>({});

      executeOptions = {
        creator: {},
        creatorInternals: {
          client: queryClientConfig,
          method: 'GET',
          route: '/stuff',
        },
        deps,
        state,
        queryConfig: {},
      };
    });
  });

  it('createExecuteFn should work', () => {
    TestBed.runInInjectionContext(() => {
      const fn = createExecuteFn(executeOptions);

      expect(typeof fn).toBe('function');
      expect(typeof fn.reset).toBe('function');
    });
  });

  it('invoking the function returned by createExecuteFn should start execution', () => {
    TestBed.runInInjectionContext(() => {
      const fn = createExecuteFn(executeOptions);

      expect(state.lastTimeExecutedAt()).toBe(null);

      fn({ args });

      expect(state.lastTimeExecutedAt()).not.toBe(null);
    });
  });

  it('invoking the function returned by createExecuteFn should work without using args', () => {
    TestBed.runInInjectionContext(() => {
      const fn = createExecuteFn(executeOptions);

      expect(state.lastTimeExecutedAt()).toBe(null);

      fn();

      expect(state.lastTimeExecutedAt()).not.toBe(null);
    });
  });

  it('invoking the reset function returned by createExecuteFn should reset the state', () => {
    TestBed.runInInjectionContext(() => {
      const fn = createExecuteFn(executeOptions);

      expect(state.lastTimeExecutedAt()).toBe(null);

      fn({ args });

      expect(state.lastTimeExecutedAt()).not.toBe(null);

      fn.reset();

      expect(state.lastTimeExecutedAt()).toBe(null);
    });
  });
});
