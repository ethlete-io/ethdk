import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { effect, signal, untracked } from '@angular/core';
import { filter, of, Subscription } from 'rxjs';
import { HttpCancelEvent } from './http-request';
import { ObservableSignal } from './observable-signal';
import { createObservableSignalWatcher } from './observable-signal-watcher';
import { QueryArgs, QuerySnapshot } from './query';
import { injectQueryContext } from './query-context';
import { QueryDependencies } from './query-dependencies';
import { createQueryErrorResponse } from './query-error-response';
import { InternalQueryExecute } from './query-execute';
import { QueryState, setupQueryState } from './query-state';

export type CreateQuerySnapshotOptions<TArgs extends QueryArgs> = {
  state: QueryState<TArgs>;
  execute: InternalQueryExecute<TArgs>;
  deps: QueryDependencies;
};

const CANCEL_EVENT: HttpCancelEvent = { type: 'cancel' };

const createCancelledError = () =>
  createQueryErrorResponse(
    new HttpErrorResponse({ status: 0, statusText: 'Cancelled', error: { message: 'The request was cancelled.' } }),
    { retryCount: 0, retryFn: () => ({ retry: false }) },
  );

const frozenObservableSignal = <T>(value: T): ObservableSignal<T> =>
  Object.assign(signal(value).asReadonly(), { asObservable: () => of(value) });

const createDestroyedSnapshot = <TArgs extends QueryArgs>(
  state: QueryState<TArgs>,
  execute: InternalQueryExecute<TArgs>,
): QuerySnapshot<TArgs> => {
  const error = createCancelledError();

  return {
    args: frozenObservableSignal(state.args()),
    response: frozenObservableSignal(null),
    latestHttpEvent: frozenObservableSignal(CANCEL_EVENT),
    loading: frozenObservableSignal(null),
    error: frozenObservableSignal(error),
    lastTimeExecutedAt: frozenObservableSignal(state.lastTimeExecutedAt()),
    triggeredBy: frozenObservableSignal(state.lastTriggeredBy()),
    isAlive: frozenObservableSignal(false),
    id: frozenObservableSignal(execute.currentRepositoryKey()),
    executionState: frozenObservableSignal({ type: 'failure', error, hasCachedResponse: false }),
  };
};

export const createQuerySnapshotFn = <TArgs extends QueryArgs>(options: CreateQuerySnapshotOptions<TArgs>) => {
  const { state } = options;
  const context = injectQueryContext();

  const snapshotFn = () =>
    untracked(() => {
      // Every signal below binds to the query's injector, which throws NG0205 once it is destroyed.
      if (context.deps.destroyRef.destroyed) return createDestroyedSnapshot(state, options.execute);

      const snapshotState = setupQueryState<TArgs>({});
      const isAlive = signal(true);

      let cancelSubscription = Subscription.EMPTY;
      let abortSubscription = Subscription.EMPTY;
      let unregisterScopeListener: (() => void) | null = null;

      const settle = () => {
        killEffectRef.destroy();
        cancelSubscription.unsubscribe();
        abortSubscription.unsubscribe();
        unregisterScopeListener?.();
        isAlive.set(false);
      };

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
            snapshotState.lastTimeExecutedAt.set(currentLastTimeExecutedAt);
            snapshotState.lastTriggeredBy.set(currentLastTriggeredBy);
            snapshotState.latestHttpEvent.set(currentLatestHttpEvent);
            snapshotState.loading.set(currentLoading);
            // `snapshotState.error` is derived from `snapshotState.rawResponse`, so a write to the
            // response resets an error set before it. Copy the response first.
            snapshotState.rawResponse.set(currentResponse);
            snapshotState.error.set(currentError);

            if (currentLoading) return;

            const hasCompletedResponse = currentLatestHttpEvent?.type === HttpEventType.Response;
            if (!hasCompletedResponse && !currentError) return;

            // kill the effect once loading is done and we either have a response or an error
            settle();
          });
        },
        { injector: context.deps.injector },
      );

      const cancel = () =>
        untracked(() => {
          if (!isAlive()) return;

          snapshotState.loading.set(null);
          snapshotState.latestHttpEvent.set(CANCEL_EVENT);
          snapshotState.rawResponse.set(null);
          snapshotState.error.set(createCancelledError());

          settle();
        });

      const abort = () =>
        untracked(() => {
          if (!isAlive()) return;

          snapshotState.loading.set(null);
          snapshotState.latestHttpEvent.set(CANCEL_EVENT);
          snapshotState.rawResponse.set(null);
          snapshotState.error.set(null);

          settle();
        });

      abortSubscription = options.execute.aborted$.subscribe(abort);

      cancelSubscription = state.events$
        .pipe(filter((event): event is HttpCancelEvent => event.type === 'cancel'))
        .subscribe(cancel);

      // A destroyed scope tears the request down without the query ever seeing the cancel event, so the
      // snapshot has to settle itself - otherwise `executeUntilSettled` resolves with a snapshot still
      // reporting the execution as loading.
      unregisterScopeListener = context.deps.destroyRef.onDestroy(cancel);

      const watcher = createObservableSignalWatcher(context.deps.injector);
      const snapshot: QuerySnapshot<TArgs> = {
        args: watcher.wrap(snapshotState.args.asReadonly()),
        response: watcher.wrap(snapshotState.response),
        latestHttpEvent: watcher.wrap(snapshotState.latestHttpEvent.asReadonly()),
        loading: watcher.wrap(snapshotState.loading.asReadonly()),
        error: watcher.wrap(snapshotState.error.asReadonly()),
        lastTimeExecutedAt: watcher.wrap(snapshotState.lastTimeExecutedAt.asReadonly()),
        triggeredBy: watcher.wrap(snapshotState.lastTriggeredBy.asReadonly()),
        isAlive: watcher.wrap(isAlive.asReadonly()),
        id: watcher.wrap(options.execute.currentRepositoryKey),
        executionState: watcher.wrap(snapshotState.executionState),
      };

      return snapshot;
    });

  return snapshotFn;
};
