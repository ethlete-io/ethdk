import { runInInjectionContext } from '@angular/core';
import { CreateGqlQueryOptions, isCreateGqlQueryOptions } from '../gql/gql-query';
import { AnyCreateGqlQueryCreatorOptions, GqlQueryMethod } from '../gql/gql-query-creator';
import { wrapAsObservableSignal } from './observable-signal';
import { CreateQueryOptions, Query, QueryArgs, RawResponseType, ReadonlyQuery, ResponseType } from './query';
import { AnyCreateQueryClientResult } from './query-client';
import {
  CreateQueryCreatorOptions,
  InternalCreateQueryCreatorOptions,
  QueryConfig,
  QueryMethod,
} from './query-creator';
import { QueryDependencies, setupQueryDependencies } from './query-dependencies';
import {
  queryFeatureUsedMultipleTimes,
  silenceMissingWithArgsFeatureErrorUsedButWithArgsPresent,
  withArgsQueryFeatureMissingButRouteIsFunction,
} from './query-errors';
import { InternalQueryExecute } from './query-execute';
import { QueryFeature, QueryFeatureContext, QueryFeatureFlags, QueryFeatureType } from './query-features';
import { createQuerySnapshotFn } from './query-snapshot';
import { QueryState, setupQueryState } from './query-state';

export const shouldAutoExecuteQuery = (method: QueryMethod) => {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
};

export const shouldAutoExecuteGqlQuery = (method: GqlQueryMethod) => {
  return method === 'QUERY';
};

export const getQueryFeatureUsage = <TArgs extends QueryArgs>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: CreateQueryOptions<TArgs> | CreateGqlQueryOptions<any>,
) => {
  const { creator, features, queryConfig, creatorInternals } = options;

  const hasWithArgsFeature = features.some((f) => f.type == QueryFeatureType.WITH_ARGS);
  const shouldAutoExecuteMethod = isCreateGqlQueryOptions(options)
    ? shouldAutoExecuteGqlQuery(options.creatorInternals.method)
    : shouldAutoExecuteQuery(options.creatorInternals.method);
  const hasRouteFunction =
    typeof (creatorInternals as InternalCreateQueryCreatorOptions<TArgs>)?.route === 'function' ||
    typeof (creator as AnyCreateGqlQueryCreatorOptions)?.route === 'function';
  const shouldAutoExecute = shouldAutoExecuteMethod && !queryConfig.onlyManualExecution;

  if (hasRouteFunction && !hasWithArgsFeature && !queryConfig.silenceMissingWithArgsFeatureError) {
    throw withArgsQueryFeatureMissingButRouteIsFunction();
  }

  if (hasWithArgsFeature && queryConfig.silenceMissingWithArgsFeatureError) {
    throw silenceMissingWithArgsFeatureErrorUsedButWithArgsPresent();
  }

  const featureFnContext: QueryFeatureFlags = {
    hasWithArgsFeature,
    shouldAutoExecuteMethod,
    shouldAutoExecute,
    hasRouteFunction,
    onlyManualExecution: queryConfig.onlyManualExecution,
    method: isCreateGqlQueryOptions(options)
      ? `GQL ${options.creatorInternals.method}`
      : options.creatorInternals.method,
  };

  return featureFnContext;
};

export const applyQueryFeatures = <TArgs extends QueryArgs>(
  features: QueryFeature<TArgs>[],
  context: QueryFeatureContext<TArgs>,
) => {
  const featureTypes = new Set<QueryFeatureType>();

  for (const feature of features) {
    if (featureTypes.has(feature.type)) {
      throw queryFeatureUsedMultipleTimes(feature.type);
    }

    featureTypes.add(feature.type);
    feature.fn(context);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const maybeExecute = (options: { flags: QueryFeatureFlags; execute: InternalQueryExecute<any> }) => {
  if (options.flags.shouldAutoExecute && !options.flags.hasRouteFunction && !options.flags.hasWithArgsFeature) {
    options.execute();
  }
};

export type CreateQueryObjectOptions<TArgs extends QueryArgs> = {
  state: QueryState<TArgs>;
  deps: QueryDependencies;
  execute: InternalQueryExecute<TArgs>;
};

export const createQueryObject = <TArgs extends QueryArgs>(options: CreateQueryObjectOptions<TArgs>) => {
  const { state, execute, deps } = options;

  const destroy = () => deps.injector.destroy();
  const setResponse = (response: ResponseType<TArgs>) => state.rawResponse.set(response as RawResponseType<TArgs>);
  const createSnapshot = createQuerySnapshotFn({ state, execute, deps });

  // Pre-wrap all public signals once so both `query` and `roQuery` share the same instances.
  const wrappedArgs = wrapAsObservableSignal(state.args.asReadonly(), deps.injector);
  const wrappedResponse = wrapAsObservableSignal(state.response, deps.injector);
  const wrappedLatestHttpEvent = wrapAsObservableSignal(state.latestHttpEvent.asReadonly(), deps.injector);
  const wrappedLoading = wrapAsObservableSignal(state.loading.asReadonly(), deps.injector);
  const wrappedError = wrapAsObservableSignal(state.error.asReadonly(), deps.injector);
  const wrappedLastTimeExecutedAt = wrapAsObservableSignal(state.lastTimeExecutedAt.asReadonly(), deps.injector);
  const wrappedTriggeredBy = wrapAsObservableSignal(state.lastTriggeredBy.asReadonly(), deps.injector);
  const wrappedId = wrapAsObservableSignal(execute.currentRepositoryKey, deps.injector);
  const wrappedExecutionState = wrapAsObservableSignal(state.executionState, deps.injector);
  const wrappedRequest = wrapAsObservableSignal(state.subtle.request.asReadonly(), deps.injector);

  const asReadonly = () => {
    const roQuery: ReadonlyQuery<TArgs> = {
      args: wrappedArgs,
      response: wrappedResponse,
      latestHttpEvent: wrappedLatestHttpEvent,
      loading: wrappedLoading,
      error: wrappedError,
      lastTimeExecutedAt: wrappedLastTimeExecutedAt,
      triggeredBy: wrappedTriggeredBy,
      id: wrappedId,
      createSnapshot,
      executionState: wrappedExecutionState,
    };

    return roQuery;
  };

  const query: Query<TArgs> = {
    execute,
    args: wrappedArgs,
    response: wrappedResponse,
    latestHttpEvent: wrappedLatestHttpEvent,
    loading: wrappedLoading,
    error: wrappedError,
    lastTimeExecutedAt: wrappedLastTimeExecutedAt,
    triggeredBy: wrappedTriggeredBy,
    id: wrappedId,
    createSnapshot,
    reset: execute.reset,
    asReadonly,
    executionState: wrappedExecutionState,
    subtle: {
      destroy,
      setResponse,
      request: wrappedRequest,
      destroyRef: deps.scopeDestroyRef,
      injector: deps.injector,
    },
  };

  return query;
};

export type ExecuteFactory<TArgs extends QueryArgs, TInternals> = (options: {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator?: CreateQueryCreatorOptions;
  creatorInternals: TInternals;
  queryConfig: QueryConfig;
}) => InternalQueryExecute<TArgs>;

export type CreateBaseQueryOptions<TArgs extends QueryArgs, TInternals> = {
  creator?: CreateQueryCreatorOptions;
  creatorInternals: TInternals;
  features: QueryFeature<TArgs>[];
  queryConfig: QueryConfig;
  executeFactory: ExecuteFactory<TArgs, TInternals>;
};

export const createBaseQuery = <TArgs extends QueryArgs, TInternals extends { client: AnyCreateQueryClientResult }>(
  options: CreateBaseQueryOptions<TArgs, TInternals>,
) => {
  const client = options.creatorInternals.client;

  const deps = setupQueryDependencies({
    client,
    queryConfig: options.queryConfig,
  });

  return runInInjectionContext(deps.injector, () => {
    const state = setupQueryState<TArgs>({
      transformResponse: options.creator?.transformResponse,
    });
    const flags = getQueryFeatureUsage(options as unknown as Parameters<typeof getQueryFeatureUsage>[0]);

    const execute = options.executeFactory({
      deps,
      state,
      creator: options.creator,
      creatorInternals: options.creatorInternals,
      queryConfig: options.queryConfig,
    });

    const featureFnContext: QueryFeatureContext<TArgs> = {
      state,
      execute,
      flags,
      deps,
    };

    applyQueryFeatures(options.features, featureFnContext);

    maybeExecute({ execute, flags });

    return createQueryObject({ state, execute, deps });
  });
};
