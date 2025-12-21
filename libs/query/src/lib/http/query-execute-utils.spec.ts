import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QueryArgs, RequestArgs } from './query';
import { createQueryClient, QueryClient } from './query-client';
import { QueryDependencies, setupQueryDependencies } from './query-dependencies';
import { CreateQueryExecuteOptions } from './query-execute';
import { queryExecute, QueryExecuteState, resetExecuteState, setupQueryExecuteState } from './query-execute-utils';
import { QueryState, setupQueryState } from './query-state';

describe('query execute utils', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'test' });

  let args: RequestArgs<QueryArgs>;
  let deps: QueryDependencies;
  let state: QueryState<QueryArgs>;
  let executeOptions: CreateQueryExecuteOptions<QueryArgs>;
  let executeState: QueryExecuteState;
  let queryClient: QueryClient;

  beforeEach(() => {
    const [, , clientToken] = client;

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    queryClient = TestBed.inject(clientToken);

    TestBed.runInInjectionContext(() => {
      args = { queryParams: { id: 1 } };
      deps = setupQueryDependencies({ client, queryConfig: {} });
      state = setupQueryState<QueryArgs>({});

      executeOptions = {
        creatorInternals: {
          client,
          method: 'GET',
          route: '/stuff',
        },
        deps,
        state,
        queryConfig: {},
      };
      executeState = setupQueryExecuteState();
    });
  });

  it('queryExecute should work', () => {
    TestBed.runInInjectionContext(() => {
      const lastTimeExecutedAt = state.lastTimeExecutedAt();

      queryExecute({
        args,
        executeOptions,
        executeState,
      });

      expect(state.lastTimeExecutedAt()).not.toEqual(lastTimeExecutedAt);
    });
  });

  it('resetExecuteState should work', () => {
    const unbindSpy = vi.spyOn(queryClient.repository, 'unbind');

    TestBed.runInInjectionContext(() => {
      queryExecute({
        args,
        executeOptions,
        executeState,
      });

      expect(state.lastTimeExecutedAt()).not.toBeNull();

      resetExecuteState({ executeOptions, executeState });

      expect(unbindSpy).toHaveBeenCalled();
      expect(state.lastTimeExecutedAt()).toBeNull();
      expect(state.args()).toBeNull();
      expect(state.error()).toBeNull();
      expect(state.latestHttpEvent()).toBeNull();
      expect(state.loading()).toBeNull();
      expect(state.response()).toBeNull();
    });

    unbindSpy.mockRestore();
  });
});
