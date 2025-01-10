import { effect, signal, untracked } from '@angular/core';
import { QueryArgs, QuerySnapshot } from './query';
import { QueryDependencies } from './query-dependencies';
import { QueryExecute } from './query-execute';
import { QueryState, setupQueryState } from './query-state';
import { normalizeQueryRepositoryKey } from './query-utils';

export type CreateQuerySnapshotOptions<TArgs extends QueryArgs> = {
  state: QueryState<TArgs>;
  deps: QueryDependencies;
  execute: QueryExecute<TArgs>;
};

export const createQuerySnapshotFn = <TArgs extends QueryArgs>(options: CreateQuerySnapshotOptions<TArgs>) => {
  const { state, deps } = options;

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

        untracked(() => {
          snapshotState.args.set(currentArgs);
          snapshotState.error.set(currentError);
          snapshotState.lastTimeExecutedAt.set(currentLastTimeExecutedAt);
          snapshotState.latestHttpEvent.set(currentLatestHttpEvent);
          snapshotState.loading.set(currentLoading);
          snapshotState.response.set(currentResponse);

          if (currentLoading) return;

          if (!currentResponse && !currentError) return;

          // kill the effect once loading is done and we either have a response or an error
          killEffectRef.destroy();

          isAlive.set(false);
        });
      },
      { injector: deps.injector },
    );

    const snapshot: QuerySnapshot<TArgs> = {
      args: snapshotState.args.asReadonly(),
      response: snapshotState.response.asReadonly(),
      latestHttpEvent: snapshotState.latestHttpEvent.asReadonly(),
      loading: snapshotState.loading.asReadonly(),
      error: snapshotState.error.asReadonly(),
      lastTimeExecutedAt: snapshotState.lastTimeExecutedAt.asReadonly(),
      isAlive: isAlive.asReadonly(),
      id: normalizeQueryRepositoryKey(options.execute.currentRepositoryKey),
    };

    return snapshot;
  };

  return snapshotFn;
};
