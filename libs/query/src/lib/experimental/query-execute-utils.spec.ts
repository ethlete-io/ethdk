import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QueryArgs, RequestArgs } from './query';
import { provideQueryClient, QueryClient } from './query-client';
import { createQueryClientConfig } from './query-client-config';
import { QueryDependencies, setupQueryDependencies } from './query-dependencies';
import { CreateQueryExecuteOptions } from './query-execute';
import {
  cleanupPreviousExecute,
  queryExecute,
  QueryExecuteState,
  resetExecuteState,
  setupQueryExecuteState,
} from './query-execute-utils';
import { QueryState, setupQueryState } from './query-state';

describe('query execute utils', () => {
  const queryClientConfig = createQueryClientConfig({ baseUrl: 'https://example.com', name: 'test' });

  let args: RequestArgs<QueryArgs>;
  let deps: QueryDependencies;
  let state: QueryState<QueryArgs>;
  let executeOptions: CreateQueryExecuteOptions<QueryArgs>;
  let executeState: QueryExecuteState;
  let queryClient: QueryClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideQueryClient(queryClientConfig), provideHttpClient(), provideHttpClientTesting()],
    });

    queryClient = TestBed.inject(queryClientConfig.token);

    TestBed.runInInjectionContext(() => {
      args = { queryParams: { id: 1 } };
      deps = setupQueryDependencies({ clientConfig: queryClientConfig });
      state = setupQueryState<QueryArgs>({});

      executeOptions = {
        creator: {
          route: '/stuff',
        },
        creatorInternals: {
          client: queryClientConfig,
          method: 'GET',
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

  it('cleanupPreviousExecute should work', () => {
    TestBed.runInInjectionContext(() => {
      queryExecute({
        args,
        executeOptions,
        executeState,
      });

      expect(executeState.effectRefs.length).toBe(4);

      cleanupPreviousExecute({ executeOptions, executeState });

      expect(executeState.effectRefs.length).toBe(0);
    });
  });

  it('resetExecuteState should work', () => {
    const unbindSpy = jest.spyOn(queryClient.repository, 'unbind');

    TestBed.runInInjectionContext(() => {
      queryExecute({
        args,
        executeOptions,
        executeState,
      });

      expect(executeState.effectRefs.length).toBe(4);
      expect(state.lastTimeExecutedAt()).not.toBeNull();

      resetExecuteState({ executeOptions, executeState });

      expect(executeState.effectRefs.length).toBe(0);
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
