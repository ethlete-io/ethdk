import { computed, EffectRef, runInInjectionContext, Signal, signal, untracked, WritableSignal } from '@angular/core';
import { QueryArgs, RequestArgs } from './query';
import { CreateQueryExecuteOptions } from './query-execute';
import { nestedEffect } from './query-utils';

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

  isSecure?: boolean;
};

export const bindSignalToTarget = <T>(signal: Signal<T>, target: WritableSignal<T>) => {
  target.set(signal());

  return nestedEffect(() => {
    const val = signal();

    untracked(() => {
      if (val === target()) return;

      target.set(val);
    });
  });
};

export const queryExecute = <TArgs extends QueryArgs>(options: QueryExecuteOptions<TArgs>) => {
  const {
    executeOptions,
    args,
    executeState,
    options: runQueryOptions,
    internalOptions: internalRunQueryOptions,
    transformResponse,
    isSecure,
  } = options;
  const { deps, state, creator, creatorInternals, queryConfig } = executeOptions;

  const { key, request } = deps.client.repository.request({
    route: creatorInternals.route,
    method: creatorInternals.method,
    args,
    clientOptions: creator,
    consumerDestroyRef: deps.destroyRef,
    key: queryConfig.key,
    previousKey: executeState.previousKey(),
    internalRunQueryOptions,
    runQueryOptions,
    isSecure,
  });

  executeState.previousKey.set(key);

  const responseSignal = transformResponse ? computed(() => transformResponse(request.response())) : request.response;

  runInInjectionContext(deps.injector, () => {
    const responseRef = bindSignalToTarget(responseSignal, state.response);
    const loadingRef = bindSignalToTarget(request.loading, state.loading);
    const errorRef = bindSignalToTarget(request.error, state.error);
    const latestHttpEventRef = bindSignalToTarget(request.currentEvent, state.latestHttpEvent);

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
