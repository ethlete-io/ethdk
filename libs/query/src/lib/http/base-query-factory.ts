import { HttpEventType } from '@angular/common/http';
import { computed, effect, runInInjectionContext } from '@angular/core';
import { describeQueryDevtoolsFeatures } from '../devtools/query-devtools-features';
import {
  createQueryDevtoolsFormLinksRecorder,
  createQueryDevtoolsOverridesRecorder,
  createQueryDevtoolsStatsRecorder,
  currentQueryDevtoolsBatch,
  registerQueryDevtoolsEntry,
} from '../devtools/query-devtools-hook';
import { CreateGqlQueryOptions } from '../gql/gql-query';
import { isCreateGqlQueryOptions } from './internal/gql-options-guard';
import { AnyCreateGqlQueryCreatorOptions, GqlQueryMethod } from '../gql/gql-query-creator';
import { HttpRequest, HttpRequestLoadingState } from './http-request';
import { wrapAsObservableSignal } from './observable-signal';
import { CreateQueryOptions, Query, QueryArgs, ReadonlyQuery, ResponseType } from './query';
import { QueryErrorResponse } from './query-error-response';
import { AnyCreateQueryClientResult } from './query-client';
import {
  CreateQueryCreatorOptions,
  InternalCreateQueryCreatorOptions,
  QueryConfig,
  QueryMethod,
} from './query-creator';
import { QueryDependencies, setupQueryDependencies } from './query-dependencies';
import {
  invalidatesUsedOnRead,
  queryFeatureUsedMultipleTimes,
  silenceMissingWithArgsFeatureErrorUsedButWithArgsPresent,
  withArgsQueryFeatureMissingButRouteIsFunction,
} from './query-errors';
import { InternalQueryExecute } from './query-execute';
import { QueryFeature, QueryFeatureContext, QueryFeatureFlags, QueryFeatureType } from './query-features';
import { invalidateOnSuccess } from './query-invalidation';
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

  const hasWithArgsFeature = features.some((f) => f.type === QueryFeatureType.WITH_ARGS);
  const hasPollingFeature = features.some((f) => f.type === QueryFeatureType.WITH_POLLING);
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
    hasPollingFeature,
    shouldAutoExecuteMethod,
    shouldAutoExecute,
    hasRouteFunction,
    onlyManualExecution: queryConfig.onlyManualExecution,
    isMultiTabSyncEnabled: creator?.multiTabSync !== false,
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
  const featureTypes = new Set<string>();

  for (const feature of features) {
    if (featureTypes.has(feature.type)) {
      throw queryFeatureUsedMultipleTimes(feature.type);
    }

    featureTypes.add(feature.type);
    feature.fn(context);
  }
};

export const maybeExecute = <TArgs extends QueryArgs>(options: {
  flags: QueryFeatureFlags;
  execute: InternalQueryExecute<TArgs>;
  state: QueryState<TArgs>;
}) => {
  const guard = options.state.subtle.autoExecuteGuard();

  if (
    options.flags.shouldAutoExecute &&
    !options.flags.hasRouteFunction &&
    !options.flags.hasWithArgsFeature &&
    (guard === null || guard())
  ) {
    options.execute();
  }
};

const trackRefreshedExecutions = <TArgs extends QueryArgs>(options: {
  state: QueryState<TArgs>;
  deps: QueryDependencies;
}) => {
  const { state, deps } = options;

  const subscription = deps.client.repository.events$.subscribe((event) => {
    if (event.type !== 'queries-refreshed') return;

    const request = state.subtle.request();

    if (!request || !event.requests.includes(request as HttpRequest<QueryArgs>)) return;

    state.lastTimeExecutedAt.set(Date.now());
    state.lastTriggeredBy.set(null);
  });

  deps.destroyRef.onDestroy(() => subscription.unsubscribe());
};

export type CreateQueryObjectOptions<TArgs extends QueryArgs> = {
  state: QueryState<TArgs>;
  deps: QueryDependencies;
  execute: InternalQueryExecute<TArgs>;
};

export const createQueryObject = <TArgs extends QueryArgs>(options: CreateQueryObjectOptions<TArgs>) => {
  const { state, execute, deps } = options;

  const destroy = () => {
    if (!deps.injector.destroyed) deps.injector.destroy();
  };
  const setResponse = (response: ResponseType<TArgs>) => state.response.set(response);
  const setLoading = (loading: HttpRequestLoadingState | null) => state.loading.set(loading);
  const setError = (error: QueryErrorResponse | null) => state.error.set(error);
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
  const wrappedUrl = wrapAsObservableSignal(
    computed(() => state.subtle.request()?.url ?? null),
    deps.injector,
  );

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
      url: wrappedUrl,
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
    url: wrappedUrl,
    reset: execute.reset,
    abort: execute.abort,
    asReadonly,
    executionState: wrappedExecutionState,
    subtle: {
      destroy,
      setResponse,
      setLoading,
      setError,
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
    const batchOwner = currentQueryDevtoolsBatch();
    const devtoolsStats = createQueryDevtoolsStatsRecorder();
    const devtoolsFormLinks = createQueryDevtoolsFormLinksRecorder();
    const devtoolsOverrides = createQueryDevtoolsOverridesRecorder();

    const flags = getQueryFeatureUsage(options as unknown as Parameters<typeof getQueryFeatureUsage>[0]);
    const state = setupQueryState<TArgs>({
      transformResponse: options.creator?.transformResponse,
      destroyRef: deps.destroyRef,
      keepPreviousResponse: options.queryConfig.keepPreviousResponse ?? flags.shouldAutoExecuteMethod,
      devtoolsStats,
      devtoolsFormLinks,
      devtoolsOverrides,
    });

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

    const invalidates = options.creator?.invalidates;

    if (invalidates) {
      if (flags.shouldAutoExecuteMethod) throw invalidatesUsedOnRead(flags.method);

      invalidateOnSuccess<TArgs>({ invalidates, state, deps });
    }

    maybeExecute({ execute, flags, state });

    trackRefreshedExecutions({ state, deps });

    const query = createQueryObject({ state, execute, deps });

    // Only ever non-null while the devtools are installed, so this whole block - the entry and the
    // per-response payload measuring behind it - is dead code in an app without them.
    if (devtoolsStats) {
      const statsSubscription = state.events$.subscribe((event) => {
        if (event.type === 'error') {
          devtoolsStats.recordError({ faulted: event.faulted, error: event.error });
        } else if (event.type === HttpEventType.Response) {
          devtoolsStats.recordResponse({ headers: event.headers, body: event.body });
        }
      });

      deps.destroyRef.onDestroy(() => statsSubscription.unsubscribe());

      // A retry happens inside the request, which is shared by every query hitting the same cache key -
      // so the recorder reads it off the request instead of being handed down into one. `recordRetry` is
      // idempotent per attempt, which is what makes reading a signal a safe way to count them.
      effect(() => {
        const retry = state.subtle.request()?.subtle.retryState();

        if (retry) devtoolsStats.recordRetry({ attempt: retry.attempt });
      });

      const unregister = registerQueryDevtoolsEntry({
        kind: 'query',
        handle: query,
        clientRef: client,
        stats: devtoolsStats,
        formLinks: devtoolsFormLinks ?? undefined,
        overrides: devtoolsOverrides ?? undefined,
        route:
          (options.creatorInternals as { route?: unknown }).route ??
          (options.creator as { route?: unknown } | undefined)?.route ??
          null,
        authProviderRef: (options.creatorInternals as { authProvider?: { token?: unknown } }).authProvider,
        meta: {
          clientBaseUrl: deps.client.baseUrl,
          method: flags.method,
          features: describeQueryDevtoolsFeatures(options.features),
          queryConfig: options.queryConfig,
          creator: options.creator,
          repository: deps.client.repository,
          client: deps.client,
          element: deps.hostElement,
          gqlQuery: (options.creatorInternals as { query?: string }).query,
          batch: batchOwner?.batch,
          batchItemIndex: batchOwner?.index,
        },
      });

      deps.destroyRef.onDestroy(unregister);
    }

    return query;
  });
};
