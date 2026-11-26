import { describe, expect, it, Mock, vi } from 'vitest';
import { createBaseQueryCreator } from './base-query-creator-factory';
import { Query } from './query';
import { QueryConfig } from './query-creator';
import { QueryFeature, QueryFeatureType } from './query-features';

type TestQueryArgs = {
  response: { message: string };
  body: { name: string };
};

type TestCreatorOptions = {
  customOption: string;
};

type TestInternals = {
  route: string;
  method: string;
};

type QueryFactoryFn = (config: {
  creator: TestCreatorOptions | undefined;
  creatorInternals: TestInternals;
  features: QueryFeature<TestQueryArgs>[];
  queryConfig: QueryConfig;
}) => Query<TestQueryArgs>;

describe('createBaseQueryCreator', () => {
  it('should create a query creator function', () => {
    const mockQueryFactory = vi.fn(() => ({}) as Query<TestQueryArgs>) as Mock<QueryFactoryFn>;

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: { customOption: 'test' },
      internals: { route: '/test', method: 'GET' },
      queryFactory: mockQueryFactory,
    });

    expect(typeof creator).toBe('function');
  });

  it('should call queryFactory when creator is invoked with no arguments', () => {
    const mockQuery = {} as Query<TestQueryArgs>;
    const mockQueryFactory = vi.fn(() => mockQuery) as Mock<QueryFactoryFn>;

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: { customOption: 'value' },
      internals: { route: '/users', method: 'POST' },
      queryFactory: mockQueryFactory,
    });

    const query = creator();

    expect(mockQueryFactory).toHaveBeenCalledTimes(1);
    expect(query).toBe(mockQuery);

    expect(mockQueryFactory).toHaveBeenCalledWith({
      creator: { customOption: 'value' },
      creatorInternals: { route: '/users', method: 'POST' },
      features: [],
      queryConfig: {},
    });
  });

  it('should pass features to queryFactory', () => {
    const mockQueryFactory = vi.fn(() => ({}) as Query<TestQueryArgs>) as Mock<QueryFactoryFn>;
    const feature1: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_LOGGING,
      fn: vi.fn(),
    };
    const feature2: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_ERROR_HANDLING,
      fn: vi.fn(),
    };

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: { customOption: 'test' },
      internals: { route: '/test', method: 'GET' },
      queryFactory: mockQueryFactory,
    });

    creator(feature1, feature2);

    expect(mockQueryFactory).toHaveBeenCalledWith({
      creator: { customOption: 'test' },
      creatorInternals: { route: '/test', method: 'GET' },
      features: [feature1, feature2],
      queryConfig: {},
    });
  });

  it('should handle queryConfig as first argument', () => {
    const mockQueryFactory = vi.fn(() => ({}) as Query<TestQueryArgs>) as Mock<QueryFactoryFn>;
    const queryConfig: QueryConfig = {
      key: 'custom-key',
      onlyManualExecution: true,
    };
    const feature: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_LOGGING,
      fn: vi.fn(),
    };

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: { customOption: 'test' },
      internals: { route: '/test', method: 'GET' },
      queryFactory: mockQueryFactory,
    });

    creator(queryConfig, feature);

    expect(mockQueryFactory).toHaveBeenCalledWith({
      creator: { customOption: 'test' },
      creatorInternals: { route: '/test', method: 'GET' },
      queryConfig,
      features: [feature],
    });
  });

  it('should handle queryConfig and multiple features', () => {
    const mockQueryFactory = vi.fn(() => ({}) as Query<TestQueryArgs>) as Mock<QueryFactoryFn>;
    const queryConfig: QueryConfig = { key: 'test-key' };
    const feature1: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_LOGGING,
      fn: vi.fn(),
    };
    const feature2: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_ERROR_HANDLING,
      fn: vi.fn(),
    };
    const feature3: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_SUCCESS_HANDLING,
      fn: vi.fn(),
    };

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: { customOption: 'test' },
      internals: { route: '/test', method: 'GET' },
      queryFactory: mockQueryFactory,
    });

    creator(queryConfig, feature1, feature2, feature3);

    expect(mockQueryFactory).toHaveBeenCalledWith({
      creator: { customOption: 'test' },
      creatorInternals: { route: '/test', method: 'GET' },
      queryConfig,
      features: [feature1, feature2, feature3],
    });
  });

  it('should pass undefined options when not provided', () => {
    const mockQueryFactory = vi.fn(() => ({}) as Query<TestQueryArgs>) as Mock<QueryFactoryFn>;

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: undefined,
      internals: { route: '/test', method: 'GET' },
      queryFactory: mockQueryFactory,
    });

    creator();

    expect(mockQueryFactory).toHaveBeenCalledWith({
      creator: undefined,
      creatorInternals: { route: '/test', method: 'GET' },
      features: [],
      queryConfig: {},
    });
  });

  it('should preserve creator options across multiple invocations', () => {
    const mockQueryFactory = vi.fn(() => ({}) as Query<TestQueryArgs>) as Mock<QueryFactoryFn>;
    const options = { customOption: 'persistent' };
    const internals = { route: '/test', method: 'GET' };

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options,
      internals,
      queryFactory: mockQueryFactory,
    });

    creator();
    creator();
    creator();

    expect(mockQueryFactory).toHaveBeenCalledTimes(3);

    // All calls should have the same options and internals
    expect(mockQueryFactory).toHaveBeenNthCalledWith(1, {
      creator: options,
      creatorInternals: internals,
      features: [],
      queryConfig: {},
    });
    expect(mockQueryFactory).toHaveBeenNthCalledWith(2, {
      creator: options,
      creatorInternals: internals,
      features: [],
      queryConfig: {},
    });
    expect(mockQueryFactory).toHaveBeenNthCalledWith(3, {
      creator: options,
      creatorInternals: internals,
      features: [],
      queryConfig: {},
    });
  });

  it('should support different queryConfigs on each invocation', () => {
    const mockQueryFactory = vi.fn(() => ({}) as Query<TestQueryArgs>) as Mock<QueryFactoryFn>;

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: { customOption: 'test' },
      internals: { route: '/test', method: 'GET' },
      queryFactory: mockQueryFactory,
    });

    const config1: QueryConfig = { key: 'key1' };
    const config2: QueryConfig = { key: 'key2', onlyManualExecution: true };
    const config3: QueryConfig = { silenceMissingWithArgsFeatureError: true };

    creator(config1);
    creator(config2);
    creator(config3);

    expect(mockQueryFactory).toHaveBeenNthCalledWith(1, expect.objectContaining({ queryConfig: config1 }));
    expect(mockQueryFactory).toHaveBeenNthCalledWith(2, expect.objectContaining({ queryConfig: config2 }));
    expect(mockQueryFactory).toHaveBeenNthCalledWith(3, expect.objectContaining({ queryConfig: config3 }));
  });

  it('should handle empty queryConfig object', () => {
    const mockQueryFactory = vi.fn(() => ({}) as Query<TestQueryArgs>) as Mock<QueryFactoryFn>;

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: { customOption: 'test' },
      internals: { route: '/test', method: 'GET' },
      queryFactory: mockQueryFactory,
    });

    const emptyConfig: QueryConfig = {};
    creator(emptyConfig);

    expect(mockQueryFactory).toHaveBeenCalledWith(expect.objectContaining({ queryConfig: {} }));
  });

  it('should correctly distinguish between queryConfig and feature as first argument', () => {
    const mockQueryFactory = vi.fn(() => ({}) as Query<TestQueryArgs>) as Mock<QueryFactoryFn>;

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: { customOption: 'test' },
      internals: { route: '/test', method: 'GET' },
      queryFactory: mockQueryFactory,
    });

    // When first arg is a feature
    const feature: QueryFeature<TestQueryArgs> = {
      type: QueryFeatureType.WITH_LOGGING,
      fn: vi.fn(),
    };
    creator(feature);

    expect(mockQueryFactory).toHaveBeenLastCalledWith({
      creator: { customOption: 'test' },
      creatorInternals: { route: '/test', method: 'GET' },
      queryConfig: {},
      features: [feature],
    });

    mockQueryFactory.mockClear();

    // When first arg is queryConfig
    const queryConfig: QueryConfig = { key: 'test' };
    creator(queryConfig);

    expect(mockQueryFactory).toHaveBeenCalledWith({
      creator: { customOption: 'test' },
      creatorInternals: { route: '/test', method: 'GET' },
      queryConfig,
      features: [],
    });
  });

  it('should create independent queries on each invocation', () => {
    let callCount = 0;
    const mockQueryFactory = vi.fn(() => {
      callCount++;
      return { id: callCount } as unknown as Query<TestQueryArgs>;
    }) as Mock<QueryFactoryFn>;

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: { customOption: 'test' },
      internals: { route: '/test', method: 'GET' },
      queryFactory: mockQueryFactory,
    });

    const query1 = creator();
    const query2 = creator();
    const query3 = creator();

    expect(query1).not.toBe(query2);
    expect(query2).not.toBe(query3);
    expect(query1).not.toBe(query3);
    expect(mockQueryFactory).toHaveBeenCalledTimes(3);
  });

  it('should pass internals with all required properties', () => {
    const mockQueryFactory = vi.fn(() => ({}) as Query<TestQueryArgs>) as Mock<QueryFactoryFn>;
    const internals: TestInternals = {
      route: '/api/users/:id',
      method: 'PATCH',
    };

    const creator = createBaseQueryCreator<TestQueryArgs, TestCreatorOptions, TestInternals>({
      options: { customOption: 'test' },
      internals,
      queryFactory: mockQueryFactory,
    });

    creator();

    expect(mockQueryFactory).toHaveBeenCalledWith({
      creator: { customOption: 'test' },
      creatorInternals: internals,
      features: [],
      queryConfig: {},
    });
  });
});
