import { signal, WritableSignal } from '@angular/core';
import { QueryArgs, RequestArgs } from './query';
import { CreateQueryExecuteOptions } from './query-execute';

export type ResetExecuteStateOptions<TArgs extends QueryArgs> = {
  executeOptions: Pick<CreateQueryExecuteOptions<TArgs>, 'state' | 'deps'>;
  executeState: QueryExecuteState;
};

export const resetExecuteState = <TArgs extends QueryArgs>(options: ResetExecuteStateOptions<TArgs>) => {
  const { executeState, executeOptions: opts } = options;
  const { state } = opts;

  opts.deps.client.repository.unbind(executeState.previousKey(), opts.deps.destroyRef);

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
};

export type QueryExecuteOptions<TArgs extends QueryArgs> = {
  executeOptions: CreateQueryExecuteOptions<TArgs>;
  executeState: QueryExecuteState;

  args: RequestArgs<TArgs> | null;
  options?: RunQueryExecuteOptions;

  isSecure?: boolean;
};

export const queryExecute = <TArgs extends QueryArgs>(options: QueryExecuteOptions<TArgs>) => {
  const { executeOptions, args, executeState, options: runQueryOptions, isSecure } = options;
  const { deps, state, creator, creatorInternals, queryConfig } = executeOptions;

  const { key, request } = deps.client.repository.request({
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
  });

  executeState.previousKey.set(key);
  state.lastTimeExecutedAt.set(Date.now());
  state.lastTriggeredBy.set(runQueryOptions?.triggeredBy ?? null);
  state.subtle.request.set(request);
};

const CIRCULAR_QUERY_DEPENDENCY_ERROR_MESSAGE =
  'Query was executed more than 5 times in less than 100ms. This is usually a sign of a circular dependency.';

export const circularQueryDependencyChecker = () => {
  let lastTriggerTs = 0;
  let illegalWrites = 0;

  // Typing this as number will throw an type error during testing since it is of type Timeout in a node env.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let timeout: any = null;

  const check = () => {
    const now = performance.now();

    if (now - lastTriggerTs < 100) {
      illegalWrites++;

      if (illegalWrites > 5) {
        throw new Error(CIRCULAR_QUERY_DEPENDENCY_ERROR_MESSAGE);
      }
    }

    lastTriggerTs = now;

    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      illegalWrites = 0;
    }, 100);
  };

  return {
    check,
  };
};
