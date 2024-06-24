/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { EffectRef, Signal, runInInjectionContext } from '@angular/core';
import { syncSignal } from '@ethlete/core';
import { HttpRequestLoadingState } from './http-request';
import { CreateQueryCreatorOptions, InternalCreateQueryCreatorOptions, QueryConfig } from './query-creator';
import { QueryDependencies, setupQueryDependencies } from './query-dependencies';
import { queryFeatureUsedMultipleTimes, withArgsQueryFeatureMissingButRouteIsFunction } from './query-errors';
import { QueryFeature, QueryFeatureContext, QueryFeatureType } from './query-features';
import { QueryState, setupQueryState } from './query-state';
import { shouldAutoExecuteQuery } from './query-utils';

export type QueryArgs = {
  response?: any;
  pathParams?: Record<string, string | number>;
  queryParams?: any;
  body?: any;
};

export type ResponseType<T extends QueryArgs> = T['response'];
export type PathParamsType<T extends QueryArgs> = T['pathParams'];
export type QueryParamsType<T extends QueryArgs> = T['queryParams'];
export type BodyType<T extends QueryArgs> = T['body'];

export type RequestArgs<T extends QueryArgs> = Omit<T, 'response'>;

export type CreateQueryExecuteOptions<TArgs extends QueryArgs> = {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator: CreateQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateQueryCreatorOptions;
  queryConfig: QueryConfig;
};

export const createExecute = <TArgs extends QueryArgs>(options: CreateQueryExecuteOptions<TArgs>) => {
  const { deps, state, creator, creatorInternals, queryConfig } = options;

  let previousKey: string | false = false;

  const effectRefs: EffectRef[] = [];

  return (args = state.args()) => {
    deps.client.repository.unbind(previousKey, deps.destroyRef);

    effectRefs.forEach((ref) => ref.destroy());
    effectRefs.length = 0;

    const { key, request } = deps.client.repository.request({
      method: creatorInternals.method,
      route: creator.route,
      reportProgress: creator.reportProgress,
      withCredentials: creator.withCredentials,
      transferCache: creator.transferCache,
      responseType: creator.responseType || 'json',
      pathParams: args?.pathParams,
      queryParams: args?.queryParams,
      body: args?.body,
      destroyRef: deps.destroyRef,
      key: queryConfig.key,
    });

    previousKey = key;

    runInInjectionContext(deps.injector, () => {
      const responseRef = syncSignal(request.response, state.response);
      const loadingRef = syncSignal(request.loading, state.loading);
      const errorRef = syncSignal(request.error, state.error);
      const latestHttpEventRef = syncSignal(request.currentEvent, state.latestHttpEvent);

      effectRefs.push(responseRef, loadingRef, errorRef, latestHttpEventRef);
    });
  };
};

export type CreateQueryOptions<TArgs extends QueryArgs> = {
  creator: CreateQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateQueryCreatorOptions;
  features: QueryFeature<TArgs>[];
  queryConfig: QueryConfig;
};

export type Query<TArgs extends QueryArgs> = {
  execute: () => void;
  args: Signal<RequestArgs<TArgs> | null>;
  response: Signal<ResponseType<TArgs> | null>;
  latestHttpEvent: Signal<HttpEvent<ResponseType<TArgs>> | null>;
  loading: Signal<HttpRequestLoadingState | null>;
  error: Signal<HttpErrorResponse | null>;
};

export const createQuery = <TArgs extends QueryArgs>(options: CreateQueryOptions<TArgs>) => {
  const deps = setupQueryDependencies({ clientConfig: options.creatorInternals.client });
  const state = setupQueryState<TArgs>({});
  const { creator, creatorInternals, features, queryConfig } = options;

  const hasWithArgsFeature = features.some((f) => f.type == QueryFeatureType.WithArgs);
  const shouldAutoExecuteMethod = shouldAutoExecuteQuery(creatorInternals.method);
  const shouldAutoExecute = shouldAutoExecuteMethod && !queryConfig.onlyManualExecution;
  const hasRouteFunction = typeof creator.route === 'function';

  if (hasRouteFunction && !hasWithArgsFeature) {
    throw withArgsQueryFeatureMissingButRouteIsFunction();
  }

  const execute = createExecute<TArgs>({ deps, state, creator, creatorInternals, queryConfig: options.queryConfig });

  const featureFnContext: QueryFeatureContext<TArgs> = {
    state,
    queryConfig,
    creatorConfig: creator,
    creatorInternals,
    execute,
    shouldAutoExecute,
    shouldAutoExecuteMethod,
    hasWithArgsFeature,
    hasRouteFunction,
  };

  const featureTypes = new Set<QueryFeatureType>();

  for (const feature of features) {
    if (featureTypes.has(feature.type)) {
      throw queryFeatureUsedMultipleTimes(feature.type);
    }

    featureTypes.add(feature.type);
    feature.fn(featureFnContext);
  }

  if (shouldAutoExecute && !hasRouteFunction && !hasWithArgsFeature) execute();

  const query: Query<TArgs> = {
    execute,
    args: state.args.asReadonly(),
    response: state.response.asReadonly(),
    latestHttpEvent: state.latestHttpEvent.asReadonly(),
    loading: state.loading.asReadonly(),
    error: state.error.asReadonly(),
  };

  return query;
};
