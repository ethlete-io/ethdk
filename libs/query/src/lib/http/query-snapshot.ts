import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { effect, signal, untracked } from '@angular/core';
import { filter, Subscription } from 'rxjs';
import { HttpCancelEvent } from './http-request';
import { wrapAsObservableSignal } from './observable-signal';
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

export const createQuerySnapshotFn = <TArgs extends QueryArgs>(options: CreateQuerySnapshotOptions<TArgs>) => {
  const { state } = options;
  const context = injectQueryContext();

  const snapshotFn = () => {
    const snapshotState = setupQueryState<TArgs>({});
    const isAlive = signal(true);

    let cancelSubscription = Subscription.EMPTY;
    let unregisterScopeListener: (() => void) | null = null;

    const settle = () => {
      killEffectRef.destroy();
      cancelSubscription.unsubscribe();
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

    cancelSubscription = state.events$
      .pipe(filter((event): event is HttpCancelEvent => event.type === 'cancel'))
      .subscribe(cancel);

    // A destroyed scope tears the request down without the query ever seeing the cancel event, so the
    // snapshot has to settle itself - otherwise `executeUntilSettled` resolves with a snapshot still
    // reporting the execution as loading.
    unregisterScopeListener = context.deps.destroyRef.onDestroy(cancel);

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
