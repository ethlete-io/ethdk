/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-function */

import { HttpErrorResponse, HttpEvent, HttpHeaders } from '@angular/common/http';
import { Signal } from '@angular/core';
import { HttpRequestLoadingState } from './http-request';
import { CreateQueryCreatorOptions, InternalCreateQueryCreatorOptions, QueryConfig } from './query-creator';
import { setupQueryDependencies } from './query-dependencies';
import { createExecuteFn, QueryExecute } from './query-execute';
import { QueryFeature, QueryFeatureContext } from './query-features';
import { createQuerySnapshotFn } from './query-snapshot';
import { setupQueryState } from './query-state';
import { applyQueryFeatures, getQueryFeatureUsage, maybeExecute } from './query-utils';

export type QueryArgs = {
  response?: any;
  pathParams?: Record<string, string | number>;
  queryParams?: any;
  body?: any;
  headers?: HttpHeaders;
};

export type ResponseType<T extends QueryArgs | null> = T extends QueryArgs ? T['response'] : never;
export type PathParamsType<T extends QueryArgs | null> = T extends QueryArgs ? T['pathParams'] : never;
export type QueryParamsType<T extends QueryArgs | null> = T extends QueryArgs ? T['queryParams'] : never;
export type BodyType<T extends QueryArgs | null> = T extends QueryArgs ? T['body'] : never;

export type RequestArgs<T extends QueryArgs | null> = T extends QueryArgs ? Omit<T, 'response'> : never;

export type CreateQueryOptions<TArgs extends QueryArgs> = {
  creator: CreateQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateQueryCreatorOptions;
  features: QueryFeature<TArgs>[];
  queryConfig: QueryConfig;
};

export type QueryBase<TArgs extends QueryArgs> = {
  args: Signal<RequestArgs<TArgs> | null>;
  response: Signal<ResponseType<TArgs> | null>;
  latestHttpEvent: Signal<HttpEvent<ResponseType<TArgs>> | null>;
  loading: Signal<HttpRequestLoadingState | null>;
  error: Signal<HttpErrorResponse | null>;
  lastTimeExecutedAt: Signal<number | null>;
  id: Signal<string | false>;
};

export type QuerySnapshot<TArgs extends QueryArgs> = QueryBase<TArgs> & {
  isAlive: Signal<boolean>;
};

export type AnyQuerySnapshot = QuerySnapshot<any>;
export type AnyQuery = Query<any>;

export type Query<TArgs extends QueryArgs> = QueryBase<TArgs> & {
  execute: QueryExecute<TArgs>;
  createSnapshot: () => QuerySnapshot<TArgs>;
  destroy: () => void;
};

export const createQuery = <TArgs extends QueryArgs>(options: CreateQueryOptions<TArgs>) => {
  const deps = setupQueryDependencies({ clientConfig: options.creatorInternals.client });
  const state = setupQueryState<TArgs>({});
  const { creator, creatorInternals, queryConfig } = options;
  const flags = getQueryFeatureUsage(options);

  const execute = createExecuteFn<TArgs>({ deps, state, creator, creatorInternals, queryConfig: options.queryConfig });
  const createSnapshot = createQuerySnapshotFn({ state, deps, execute });
  const destroy = () => deps.injector.destroy();

  const featureFnContext: QueryFeatureContext<TArgs> = {
    state,
    queryConfig,
    creatorConfig: creator,
    creatorInternals,
    execute,
    flags,
    deps,
  };

  applyQueryFeatures(options, featureFnContext);

  maybeExecute<TArgs>({ execute, flags });

  const query: Query<TArgs> = {
    execute,
    args: state.args.asReadonly(),
    response: state.response.asReadonly(),
    latestHttpEvent: state.latestHttpEvent.asReadonly(),
    loading: state.loading.asReadonly(),
    error: state.error.asReadonly(),
    lastTimeExecutedAt: state.lastTimeExecutedAt.asReadonly(),
    id: execute.currentRepositoryKey,
    createSnapshot,
    destroy,
  };

  return query;
};
