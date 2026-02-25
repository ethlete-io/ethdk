import { effect, signal, untracked } from '@angular/core';
import { wrapAsObservableSignal } from './observable-signal';
import { QueryArgs, QuerySnapshot } from './query';
import { injectQueryContext } from './query-context';
import { QueryDependencies } from './query-dependencies';
import { InternalQueryExecute } from './query-execute';
import { QueryState, setupQueryState } from './query-state';

export type CreateQuerySnapshotOptions<TArgs extends QueryArgs> = {
  state: QueryState<TArgs>;
  execute: InternalQueryExecute<TArgs>;
  deps: QueryDependencies;
};

export const createQuerySnapshotFn = <TArgs extends QueryArgs>(options: CreateQuerySnapshotOptions<TArgs>) => {
  const { state } = options;
  const context = injectQueryContext();

  const snapshotFn = () => {
    const snapshotState = setupQueryState<TArgs>({});
    const isAlive = signal(true);

    const killEffectRef = effect(
      () => {
        const currentLoading = state.loading();
        const currentError = state.error();
        const currentResponse = state.response();
        const currentArgs = state.args();
        const currentLatestHttpEvent = state.latestHttpEvent();
        const currentLastTimeExecutedAt = state.lastTimeExecutedAt();
        const currentLastTriggeredBy = state.lastTriggeredBy();

        untracked(() => {
          snapshotState.args.set(currentArgs);
          snapshotState.error.set(currentError);
          snapshotState.lastTimeExecutedAt.set(currentLastTimeExecutedAt);
          snapshotState.lastTriggeredBy.set(currentLastTriggeredBy);
          snapshotState.latestHttpEvent.set(currentLatestHttpEvent);
          snapshotState.loading.set(currentLoading);
          snapshotState.rawResponse.set(currentResponse);

          if (currentLoading) return;

          if (!currentResponse && !currentError) return;

          // kill the effect once loading is done and we either have a response or an error
          killEffectRef.destroy();
          isAlive.set(false);
        });
      },
      { injector: context.deps.injector },
    );

    const snapshot: QuerySnapshot<TArgs> = {
      args: wrapAsObservableSignal(snapshotState.args.asReadonly(), context.deps.injector),
      response: wrapAsObservableSignal(snapshotState.response, context.deps.injector),
      latestHttpEvent: wrapAsObservableSignal(snapshotState.latestHttpEvent.asReadonly(), context.deps.injector),
      loading: wrapAsObservableSignal(snapshotState.loading.asReadonly(), context.deps.injector),
      error: wrapAsObservableSignal(snapshotState.error.asReadonly(), context.deps.injector),
      lastTimeExecutedAt: wrapAsObservableSignal(snapshotState.lastTimeExecutedAt.asReadonly(), context.deps.injector),
      triggeredBy: wrapAsObservableSignal(snapshotState.lastTriggeredBy.asReadonly(), context.deps.injector),
      isAlive: wrapAsObservableSignal(isAlive.asReadonly(), context.deps.injector),
      id: wrapAsObservableSignal(options.execute.currentRepositoryKey, context.deps.injector),
      executionState: wrapAsObservableSignal(snapshotState.executionState, context.deps.injector),
    };

    return snapshot;
  };

  return snapshotFn;
};
