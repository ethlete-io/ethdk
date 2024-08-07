import { EffectRef, runInInjectionContext } from '@angular/core';
import { syncSignal } from '@ethlete/core';
import { QueryArgs, RequestArgs } from './query';
import { CreateQueryExecuteOptions } from './query-execute';

export type ResetExecuteStateOptions<TArgs extends QueryArgs> = {
  executeOptions: CreateQueryExecuteOptions<TArgs>;
  executeState: QueryExecuteState;
};

export const resetExecuteState = <TArgs extends QueryArgs>(options: ResetExecuteStateOptions<TArgs>) => {
  const { executeState, executeOptions: opts } = options;
  const { deps, state } = opts;
  const { effectRefs, previousKey } = executeState;

  deps.client.repository.unbind(previousKey, deps.destroyRef);

  effectRefs.forEach((ref) => ref.destroy());
  effectRefs.length = 0;

  state.args.set(null);
  state.error.set(null);
  state.latestHttpEvent.set(null);
  state.loading.set(null);
  state.response.set(null);
  state.lastTimeExecutedAt.set(null);
};

export type QueryExecuteState = {
  effectRefs: EffectRef[];
  previousKey: string | false;
};

export const setupQueryExecuteState = (): QueryExecuteState => {
  return {
    effectRefs: [],
    previousKey: false,
  };
};

export type QueryExecuteOptions<TArgs extends QueryArgs> = {
  executeOptions: CreateQueryExecuteOptions<TArgs>;
  executeState: QueryExecuteState;

  args?: RequestArgs<TArgs> | null;
};

export const queryExecute = <TArgs extends QueryArgs>(options: QueryExecuteOptions<TArgs>) => {
  const { executeOptions, args, executeState } = options;
  const { deps, state, creator, creatorInternals, queryConfig } = executeOptions;

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
    headers: args?.headers,
  });

  executeState.previousKey = key;

  runInInjectionContext(deps.injector, () => {
    const responseRef = syncSignal(request.response, state.response);
    const loadingRef = syncSignal(request.loading, state.loading);
    const errorRef = syncSignal(request.error, state.error);
    const latestHttpEventRef = syncSignal(request.currentEvent, state.latestHttpEvent);

    executeState.effectRefs.push(responseRef, loadingRef, errorRef, latestHttpEventRef);
  });

  state.lastTimeExecutedAt.set(Date.now());
};

export const cleanupPreviousExecute = <TArgs extends QueryArgs>(options: QueryExecuteOptions<TArgs>) => {
  const { executeOptions, executeState } = options;
  const { deps } = executeOptions;

  deps.client.repository.unbind(executeState.previousKey, deps.destroyRef);

  executeState.effectRefs.forEach((ref) => ref.destroy());
  executeState.effectRefs.length = 0;
};
