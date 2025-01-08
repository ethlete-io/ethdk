import { EffectRef, runInInjectionContext, signal, WritableSignal } from '@angular/core';
import { syncSignal } from '@ethlete/core';
import { QueryArgs, RequestArgs } from './query';
import { CreateQueryExecuteOptions } from './query-execute';

export type ResetExecuteStateOptions<TArgs extends QueryArgs> = {
  executeOptions: CreateQueryExecuteOptions<TArgs>;
  executeState: QueryExecuteState;
};

export const resetExecuteState = <TArgs extends QueryArgs>(options: ResetExecuteStateOptions<TArgs>) => {
  const { executeState, executeOptions: opts } = options;
  const { state } = opts;

  cleanupPreviousExecute({ executeOptions: opts, executeState });

  opts.deps.client.repository.unbind(executeState.previousKey(), opts.deps.destroyRef);

  state.args.set(null);
  state.error.set(null);
  state.latestHttpEvent.set(null);
  state.loading.set(null);
  state.response.set(null);
  state.lastTimeExecutedAt.set(null);
};

export type QueryExecuteState = {
  effectRefs: EffectRef[];
  previousKey: WritableSignal<string | false>;
};

export const setupQueryExecuteState = (): QueryExecuteState => {
  return {
    effectRefs: [],
    previousKey: signal(false),
  };
};

export type RunQueryExecuteOptions = {
  allowCache?: boolean;
};

export type QueryExecuteOptions<TArgs extends QueryArgs> = {
  executeOptions: CreateQueryExecuteOptions<TArgs>;
  executeState: QueryExecuteState;

  args: RequestArgs<TArgs> | null;
  options?: RunQueryExecuteOptions;
};

export const queryExecute = <TArgs extends QueryArgs>(options: QueryExecuteOptions<TArgs>) => {
  const { executeOptions, args, executeState, options: runQueryOptions } = options;
  const { deps, state, creator, creatorInternals, queryConfig } = executeOptions;

  const { key, request } = deps.client.repository.request({
    route: creator.route,
    method: creatorInternals.method,
    args,
    clientOptions: {
      reportProgress: creator.reportProgress,
      withCredentials: creator.withCredentials,
      transferCache: creator.transferCache,
      responseType: creator.responseType,
    },
    destroyRef: deps.destroyRef,
    key: queryConfig.key,
    previousKey: executeState.previousKey(),
    runQueryOptions,
  });

  executeState.previousKey.set(key);

  runInInjectionContext(deps.injector, () => {
    const responseRef = syncSignal(request.response, state.response);
    const loadingRef = syncSignal(request.loading, state.loading);
    const errorRef = syncSignal(request.error, state.error);
    const latestHttpEventRef = syncSignal(request.currentEvent, state.latestHttpEvent);

    executeState.effectRefs.push(responseRef, loadingRef, errorRef, latestHttpEventRef);
  });

  state.lastTimeExecutedAt.set(Date.now());
};

export type CleanupPreviousExecuteOptions<TArgs extends QueryArgs> = {
  executeOptions: CreateQueryExecuteOptions<TArgs>;
  executeState: QueryExecuteState;
};

export const cleanupPreviousExecute = <TArgs extends QueryArgs>(options: CleanupPreviousExecuteOptions<TArgs>) => {
  const { executeState } = options;

  executeState.effectRefs.forEach((ref) => ref.destroy());
  executeState.effectRefs.length = 0;
};
