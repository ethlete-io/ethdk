import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentInjector, ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseQuery, ExecuteFactory } from './base-query-factory';
import { createQueryClient, CreateQueryClientResult } from './query-client';
import { CreateQueryCreatorOptions } from './query-creator';
import { InternalQueryExecute } from './query-execute';
import { QueryFeature, QueryFeatureType } from './query-features';

type TestQueryArgs = {
  response: { data: string };
  pathParams: { id: string };
};

type TestInternals = {
  client: CreateQueryClientResult;
  route: string;
  method: string;
};

describe('createBaseQuery', () => {
  let client: CreateQueryClientResult;
  let mockExecuteFactory: ExecuteFactory<TestQueryArgs, TestInternals>;
  let mockExecute: InternalQueryExecute<TestQueryArgs>;

  // Helper to create query within injection context
  const createTestQuery = (
    options: Omit<Parameters<typeof createBaseQuery<TestQueryArgs, TestInternals>>[0], 'executeFactory'>,
  ) => {
    return TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        ...options,
        executeFactory: mockExecuteFactory,
      }),
    );
  };

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    // Create a mock execute function with all required properties
    mockExecute = Object.assign(vi.fn(), {
      reset: vi.fn(),
      currentRepositoryKey: vi.fn(() => 'test-key'),
    }) as unknown as InternalQueryExecute<TestQueryArgs>;

    mockExecuteFactory = vi.fn(() => mockExecute) as unknown as ExecuteFactory<TestQueryArgs, TestInternals>;
  });

  it('should create a query with all required properties', () => {
    const query = TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test/:id',
          method: 'GET',
        },
        features: [],
        queryConfig: {},
        executeFactory: mockExecuteFactory,
      }),
    );

    expect(query).toBeDefined();
    expect(query.args).toBeDefined();
    expect(query.response).toBeDefined();
    expect(query.loading).toBeDefined();
    expect(query.error).toBeDefined();
    expect(query.latestHttpEvent).toBeDefined();
    expect(query.lastTimeExecutedAt).toBeDefined();
    expect(query.id).toBeDefined();
    expect(query.execute).toBeDefined();
    expect(query.createSnapshot).toBeDefined();
    expect(query.reset).toBeDefined();
    expect(query.asReadonly).toBeDefined();
    expect(query.subtle).toBeDefined();
    expect(query.executionState).toBeDefined();
  });

  it('should call the execute factory with correct options', () => {
    const creator: CreateQueryCreatorOptions = {
      reportProgress: true,
      responseType: 'json',
    };

    const internals: TestInternals = {
      client,
      route: '/users/:id',
      method: 'GET',
    };

    const queryConfig = { key: 'custom-key' };

    TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator,
        creatorInternals: internals,
        features: [],
        queryConfig,
        executeFactory: mockExecuteFactory,
      }),
    );

    expect(mockExecuteFactory).toHaveBeenCalledTimes(1);
    const [callArgs] = (mockExecuteFactory as ReturnType<typeof vi.fn>).mock.calls[0] as Parameters<
      ExecuteFactory<TestQueryArgs, TestInternals>
    >;

    expect(callArgs.creator).toBe(creator);
    expect(callArgs.creatorInternals).toBe(internals);
    expect(callArgs.queryConfig).toBe(queryConfig);
    expect(callArgs.state).toBeDefined();
    expect(callArgs.deps).toBeDefined();
  });

  it('should setup dependencies with the correct client', () => {
    TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test',
          method: 'GET',
        },
        features: [],
        queryConfig: {},
        executeFactory: mockExecuteFactory,
      }),
    );

    // Dependencies should be set up correctly
    const [callArgs] = (mockExecuteFactory as ReturnType<typeof vi.fn>).mock.calls[0] as Parameters<
      ExecuteFactory<TestQueryArgs, TestInternals>
    >;
    const [, injectClient] = client;

    TestBed.runInInjectionContext(() => {
      expect(callArgs.deps.client).toEqual(injectClient());
      expect(callArgs.deps.destroyRef).toBeDefined();
      expect(callArgs.deps.injector).toBeInstanceOf(EnvironmentInjector);
      expect(callArgs.deps.effectScheduler).toBeDefined();
      expect(callArgs.deps.ngErrorHandler).toBeInstanceOf(ErrorHandler);
      expect(callArgs.deps.httpClient).toBeInstanceOf(HttpClient);
    });
  });

  it('should apply query features', () => {
    const featureFn = vi.fn();
    const feature: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_LOGGING,
      fn: featureFn,
    };

    TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test',
          method: 'GET',
        },
        features: [feature],
        queryConfig: {},
        executeFactory: mockExecuteFactory,
      }),
    );

    expect(featureFn).toHaveBeenCalledTimes(1);
    const [context] = featureFn.mock.calls[0] as Parameters<typeof featureFn>;

    expect(context.state).toBeDefined();
    expect(context.execute).toBe(mockExecute);
    expect(context.deps).toBeDefined();
    expect(context.flags).toBeDefined();
  });

  it('should apply multiple features in order', () => {
    const callOrder: number[] = [];
    const feature1: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_LOGGING,
      fn: () => callOrder.push(1),
    };
    const feature2: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_ERROR_HANDLING,
      fn: () => callOrder.push(2),
    };
    const feature3: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_SUCCESS_HANDLING,
      fn: () => callOrder.push(3),
    };

    TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test',
          method: 'GET',
        },
        features: [feature1, feature2, feature3],
        queryConfig: {},
        executeFactory: mockExecuteFactory,
      }),
    );

    expect(callOrder).toEqual([1, 2, 3]);
  });

  it('should use custom injector from queryConfig if provided', () => {
    const customInjector = TestBed.inject(EnvironmentInjector);

    TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test',
          method: 'GET',
        },
        features: [],
        queryConfig: {
          injector: customInjector,
        },
        executeFactory: mockExecuteFactory,
      }),
    );

    expect(mockExecuteFactory).toHaveBeenCalled();
  });

  it('should execute the query immediately for auto-executable methods without withArgs', () => {
    const autoExecute = vi.fn();
    const mockAutoExecute = Object.assign(autoExecute, {
      reset: vi.fn(),
      currentRepositoryKey: vi.fn(() => 'test-key'),
    }) as unknown as InternalQueryExecute<TestQueryArgs>;

    mockExecuteFactory = vi.fn(() => mockAutoExecute);

    TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test',
          method: 'GET',
        },
        features: [],
        queryConfig: {},
        executeFactory: mockExecuteFactory,
      }),
    );

    // For GET without withArgs or route function, it should auto-execute
    expect(autoExecute).toHaveBeenCalledTimes(1);
  });

  it('should not execute the query immediately for POST method', () => {
    const execute = vi.fn();
    const mockPostExecute = Object.assign(execute, {
      reset: vi.fn(),
      currentRepositoryKey: vi.fn(() => 'test-key'),
    }) as unknown as InternalQueryExecute<TestQueryArgs>;

    mockExecuteFactory = vi.fn(() => mockPostExecute);

    TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test',
          method: 'POST',
        },
        features: [],
        queryConfig: {},
        executeFactory: mockExecuteFactory,
      }),
    );

    // POST should not auto-execute
    expect(execute).not.toHaveBeenCalled();
  });

  it('should create readonly version of query', () => {
    const query = TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test',
          method: 'GET',
        },
        features: [],
        queryConfig: {},
        executeFactory: mockExecuteFactory,
      }),
    );

    const readonly = query.asReadonly();

    expect(readonly.args).toBeDefined();
    expect(readonly.response).toBeDefined();
    expect(readonly.loading).toBeDefined();
    expect(readonly.error).toBeDefined();
    expect(readonly.latestHttpEvent).toBeDefined();
    expect(readonly.lastTimeExecutedAt).toBeDefined();
    expect(readonly.id).toBeDefined();
    expect(readonly.createSnapshot).toBeDefined();

    // Readonly should not have execute, reset, or subtle
    expect('execute' in readonly).toBe(false);
    expect('reset' in readonly).toBe(false);
    expect('subtle' in readonly).toBe(false);
    expect('asReadonly' in readonly).toBe(false);
  });

  it('should create a snapshot function', () => {
    const query = TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test',
          method: 'GET',
        },
        features: [],
        queryConfig: {},
        executeFactory: mockExecuteFactory,
      }),
    );

    const snapshot = query.createSnapshot();

    expect(snapshot).toBeDefined();
    expect(snapshot.isAlive).toBeDefined();
    expect(snapshot.args).toBeDefined();
    expect(snapshot.response).toBeDefined();
  });

  it('should have subtle methods for advanced usage', () => {
    const query = TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test',
          method: 'GET',
        },
        features: [],
        queryConfig: {},
        executeFactory: mockExecuteFactory,
      }),
    );

    expect(query.subtle.destroy).toBeDefined();
    expect(query.subtle.setResponse).toBeDefined();
    expect(query.subtle.request).toBeDefined();
    expect(query.subtle.destroyRef).toBeDefined();
    expect(query.subtle.injector).toBeDefined();

    expect(typeof query.subtle.destroy).toBe('function');
    expect(typeof query.subtle.setResponse).toBe('function');
  });

  it('should set custom response using subtle.setResponse', () => {
    const query = TestBed.runInInjectionContext(() =>
      createBaseQuery<TestQueryArgs, TestInternals>({
        creator: undefined,
        creatorInternals: {
          client,
          route: '/test',
          method: 'GET',
        },
        features: [],
        queryConfig: {},
        executeFactory: mockExecuteFactory,
      }),
    );

    expect(query.response()).toBeNull();

    query.subtle.setResponse({ data: 'custom response' });

    expect(query.response()).toEqual({ data: 'custom response' });
  });
});
