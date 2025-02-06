import { computed, EffectRef, runInInjectionContext, signal, WritableSignal } from '@angular/core';
import { syncSignal } from '@ethlete/core';
import { QueryArgs, RequestArgs } from './query';
import { CreateQueryExecuteOptions } from './query-execute';

export type ResetExecuteStateOptions<TArgs extends QueryArgs> = {
  executeOptions: Pick<CreateQueryExecuteOptions<TArgs>, 'state' | 'deps'>;
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

export type InternalRunQueryExecuteOptions = {
  /**
   * If true, the request will be forced to be cached (saved inside the query repository).
   * Can be used to e.g. cache GQL queries transported via POST
   *
   * - `true` means the request will always be cached
   * - `false` means the request will never be cached
   * - `undefined` means the request will be cached if the method is GET, OPTIONS or HEAD
   */
  useQueryRepositoryCache?: boolean;
};

export type QueryExecuteOptions<TArgs extends QueryArgs> = {
  executeOptions: CreateQueryExecuteOptions<TArgs>;
  executeState: QueryExecuteState;

  args: RequestArgs<TArgs> | null;
  options?: RunQueryExecuteOptions;
  internalOptions?: InternalRunQueryExecuteOptions;

  // TODO: Typings
  transformResponse?: (response: any) => any;
};

export const queryExecute = <TArgs extends QueryArgs>(options: QueryExecuteOptions<TArgs>) => {
  const {
    executeOptions,
    args,
    executeState,
    options: runQueryOptions,
    internalOptions: internalRunQueryOptions,
    transformResponse,
  } = options;
  const { deps, state, creator, creatorInternals, queryConfig } = executeOptions;

  const { key, request } = deps.client.repository.request({
    route: creatorInternals.route,
    method: creatorInternals.method,
    args,
    clientOptions: creator,
    destroyRef: deps.destroyRef,
    key: queryConfig.key,
    previousKey: executeState.previousKey(),
    internalRunQueryOptions,
    runQueryOptions,
  });

  executeState.previousKey.set(key);

  const responseSignal = transformResponse ? computed(() => transformResponse(request.response())) : request.response;

  runInInjectionContext(deps.injector, () => {
    const responseRef = syncSignal(responseSignal, state.response);
    const loadingRef = syncSignal(request.loading, state.loading);
    const errorRef = syncSignal(request.error, state.error);
    const latestHttpEventRef = syncSignal(request.currentEvent, state.latestHttpEvent);

    executeState.effectRefs.push(responseRef, loadingRef, errorRef, latestHttpEventRef);
  });

  state.lastTimeExecutedAt.set(Date.now());
  state.subtle.request.set(request);
};

export type CleanupPreviousExecuteOptions<TArgs extends QueryArgs> = {
  executeOptions: Pick<CreateQueryExecuteOptions<TArgs>, 'state'>;
  executeState: QueryExecuteState;
};

export const cleanupPreviousExecute = <TArgs extends QueryArgs>(options: CleanupPreviousExecuteOptions<TArgs>) => {
  const { executeState } = options;

  executeState.effectRefs.forEach((ref) => ref.destroy());
  executeState.effectRefs.length = 0;
};
