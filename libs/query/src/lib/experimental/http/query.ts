/* eslint-disable @typescript-eslint/no-explicit-any */

import { HttpEvent, HttpHeaders } from '@angular/common/http';
import { Signal } from '@angular/core';
import { HttpRequestLoadingState } from './http-request';
import { CreateQueryCreatorOptions, InternalCreateQueryCreatorOptions, QueryConfig } from './query-creator';
import { setupQueryDependencies } from './query-dependencies';
import { QueryErrorResponse } from './query-error-response';
import { createExecuteFn, QueryExecute } from './query-execute';
import { QueryFeature, QueryFeatureContext } from './query-features';
import { QueryExecutionState, setupQueryState } from './query-state';
import { applyQueryFeatures, createQueryObject, getQueryFeatureUsage, maybeExecute } from './query-utils';

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
  creator?: CreateQueryCreatorOptions;
  creatorInternals: InternalCreateQueryCreatorOptions<TArgs>;
  features: QueryFeature<TArgs>[];
  queryConfig: QueryConfig;
};

export type QueryBase<TArgs extends QueryArgs> = {
  /** The arguments of the last execution of the query. Will be `null` if the query has never been executed */
  args: Signal<RequestArgs<TArgs> | null>;

  /**
   * The latest response of the query. Will be `null` if the query has never been executed.
   * Responses are cached until a new response is received.
   * If a response is present but the next execution of the query fails, the response will be set to `null` again.
   */
  response: Signal<ResponseType<TArgs> | null>;

  /** The latest Angular HTTP client native http event that occurred during the last execution of the query. Will be `null` if no event occurred. */
  latestHttpEvent: Signal<HttpEvent<ResponseType<TArgs>> | null>;

  /** The loading state of the query. Will be `null` if the query currently isn't loading. */
  loading: Signal<HttpRequestLoadingState | null>;

  /** The error that occurred during the last execution of the query. Will be `null` if no error occurred. */
  error: Signal<QueryErrorResponse | null>;

  /** The time the query was last executed at. Will be `null` if the query has never been executed. */
  lastTimeExecutedAt: Signal<number | null>;

  /** The id of the query */
  id: Signal<string>;

  /** The current state of the query. Will be `null` if the query has never been executed. */
  executionState: Signal<QueryExecutionState<TArgs> | null>;
};

/** A snapshot of a query state at a specific point in time */
export type QuerySnapshot<TArgs extends QueryArgs> = QueryBase<TArgs> & {
  /** This signal is `true` until the latest execution of the query has completed in any way (success, error, or cancellation) */
  isAlive: Signal<boolean>;
};

export type AnyQuerySnapshot = QuerySnapshot<any>;
export type AnyQuery = Query<any>;

export type QuerySubtle<TArgs extends QueryArgs> = {
  /** Destroys the query and cleans up all resources. The query should not be used after this method is called. */
  destroy: () => void;

  /** Manually sets the response of the query. This will not trigger a new execution of the query. */
  setResponse: (response: ResponseType<TArgs>) => void;
};

export type Query<TArgs extends QueryArgs> = QueryBase<TArgs> & {
  /** Executes the query */
  execute: QueryExecute<TArgs>;

  /** Creates an immutable snapshot of the current query state */
  createSnapshot: () => QuerySnapshot<TArgs>;

  /** Resets the query state to its initial state */
  reset: () => void;

  /** Returns a readonly version of the query */
  asReadonly: () => ReadonlyQuery<TArgs>;

  /** Advanced query features. **WARNING!** Incorrectly using these features will likely **BREAK** your application. You have been warned! */
  subtle: QuerySubtle<TArgs>;
};

export type ReadonlyQuery<TArgs extends QueryArgs> = Omit<Query<TArgs>, 'execute' | 'subtle' | 'reset' | 'asReadonly'>;

export const createQuery = <TArgs extends QueryArgs>(options: CreateQueryOptions<TArgs>) => {
  const deps = setupQueryDependencies({
    clientConfig: options.creatorInternals.client,
    queryConfig: options.queryConfig,
  });
  const state = setupQueryState<TArgs>({});
  const { creator, creatorInternals, queryConfig } = options;
  const flags = getQueryFeatureUsage(options);

  const execute = createExecuteFn<TArgs>({ deps, state, creator, creatorInternals, queryConfig });

  const featureFnContext: QueryFeatureContext<TArgs> = {
    state,
    execute,
    flags,
    deps,
  };

  applyQueryFeatures(options.features, featureFnContext);

  maybeExecute({ execute, flags });

  return createQueryObject({ state, execute, deps });
};
