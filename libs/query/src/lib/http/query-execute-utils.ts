import { isDevMode, signal, WritableSignal } from '@angular/core';
import { QueryArgs, RequestArgs } from './query';
import { buildQueryCacheKey } from './query-cache-utils';
import { circularQueryDependency, queryExecutedAfterDestroyMessage } from './query-errors';
import { CreateQueryExecuteOptions } from './query-execute';

export type ResetExecuteStateOptions<TArgs extends QueryArgs> = {
  executeOptions: Pick<CreateQueryExecuteOptions<TArgs>, 'state' | 'deps'>;
  executeState: QueryExecuteState;
};

export const resetExecuteState = <TArgs extends QueryArgs>(options: ResetExecuteStateOptions<TArgs>) => {
  const { executeState, executeOptions: opts } = options;
  const { state } = opts;

  opts.deps.client.repository.unbind(executeState.previousKey(), opts.deps.destroyRef);
  executeState.previousKey.set(null);

  state.subtle.unbindRequestEvents();
  state.subtle.request.set(null);
  state.args.set(null);
  state.error.set(null);
  state.latestHttpEvent.set(null);
  state.loading.set(null);
  state.rawResponse.set(null);
  state.lastTimeExecutedAt.set(null);
  state.lastTriggeredBy.set(null);
};

export type QueryExecuteState = {
  previousKey: WritableSignal<string | null>;
};

export const setupQueryExecuteState = (): QueryExecuteState => {
  return {
    previousKey: signal(null),
  };
};

export type RunQueryExecuteOptions = {
  allowCache?: boolean;
  triggeredBy?: string;

  /**
   * Overrides the creator's (and the client's) `keepUnusedFor` for this execution. Only read while the
   * cache entry is being created: an entry that already exists keeps the retention it was created with.
   */
  keepUnusedFor?: number;
};

export type QueryExecuteOptions<TArgs extends QueryArgs> = {
  executeOptions: CreateQueryExecuteOptions<TArgs>;
  executeState: QueryExecuteState;

  args: RequestArgs<TArgs> | null;
  options?: RunQueryExecuteOptions;

  isSecure?: boolean;

  /** @see QueryRepositoryRequestOptions.isRefreshable */
  isRefreshable?: boolean;
};

export const queryExecute = <TArgs extends QueryArgs>(options: QueryExecuteOptions<TArgs>) => {
  const { executeOptions, args, executeState, isSecure, isRefreshable } = options;
  const { deps, state, creator, creatorInternals, queryConfig } = executeOptions;

  if (deps.destroyRef.destroyed) {
    if (isDevMode()) console.warn(queryExecutedAfterDestroyMessage(creatorInternals.route));

    return;
  }

  const defaultRunOptions = state.subtle.defaultRunOptions();
  const runQueryOptions =
    defaultRunOptions || options.options ? { ...defaultRunOptions, ...options.options } : undefined;

  const { key, request, executed } = deps.client.repository.request({
    route: creatorInternals.route,
    method: creatorInternals.method,
    args,
    creatorOptions: creator,
    retryFn: creator?.retryFn,
    consumerDestroyRef: deps.destroyRef,
    key: queryConfig.key,
    previousKey: executeState.previousKey(),
    runQueryOptions,
    isSecure,
    isRefreshable,
    silenceUncacheableAllowCacheError: queryConfig.silenceUncacheableAllowCacheError,
  });

  executeState.previousKey.set(key);
  state.lastTimeExecutedAt.set(Date.now());
  state.lastTriggeredBy.set(runQueryOptions?.triggeredBy ?? null);
  state.subtle.request.set(request);
  state.subtle.bindRequestEvents(request);
  state.subtle.devtoolsStats?.recordExecution({ didRequest: executed, body: args?.body, url: request.url });
};

const CIRCULAR_DEPENDENCY_WINDOW_MS = 100;
const CIRCULAR_DEPENDENCY_MAX_REPEATS = 5;

/**
 * Throws `ET800` once the same query runs with identical args more than five times in a row, each run
 * less than 100 ms after the previous one. Executions with different args (a search term typed fast,
 * a slider bound to `withArgs`) never count against each other.
 */
export const circularQueryDependencyChecker = () => {
  const recent = new Map<string, { lastTs: number; repeats: number }>();

  const check = (args: RequestArgs<QueryArgs> | null | undefined) => {
    const now = Date.now();
    const signature = buildQueryCacheKey(
      JSON.stringify([args?.pathParams ?? null, args?.queryParams ?? null]),
      args ?? undefined,
    );

    for (const [key, entry] of recent) {
      if (now - entry.lastTs >= CIRCULAR_DEPENDENCY_WINDOW_MS) recent.delete(key);
    }

    const entry = recent.get(signature);
    const repeats = entry ? entry.repeats + 1 : 1;

    if (repeats > CIRCULAR_DEPENDENCY_MAX_REPEATS) {
      recent.delete(signature);
      throw circularQueryDependency();
    }

    recent.set(signature, { lastTs: now, repeats });
  };

  return {
    check,
  };
};
