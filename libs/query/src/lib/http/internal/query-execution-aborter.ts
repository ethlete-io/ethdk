import { HttpEventType } from '@angular/common/http';
import { untracked } from '@angular/core';
import { filter, Observable, Subject } from 'rxjs';
import { QueryArgs } from '../query';
import { QueryState } from '../query-state';

export type QueryExecutionAborter = {
  /** Records the state the query shows now, unless it is loading. Call before starting an execution. */
  capture: () => void;

  /**
   * Stops the execution in flight and puts back the response, error and latest event captured before it.
   * `cancelPending` runs first, and only when something is in flight.
   */
  abort: (cancelPending?: () => void) => boolean;

  /** Emits synchronously inside `abort()`, before the request's own `cancel` event. */
  aborted$: Observable<void>;
};

export const createQueryExecutionAborter = <TArgs extends QueryArgs>(
  state: QueryState<TArgs>,
): QueryExecutionAborter => {
  const read = () => ({
    rawResponse: state.rawResponse(),
    error: state.error(),
    latestHttpEvent: state.latestHttpEvent(),
  });

  let settled = untracked(read);
  const aborted$ = new Subject<void>();

  const capture = () =>
    untracked(() => {
      if (state.loading() === null) settled = read();
    });

  // Executions the query did not start itself (a refresh, an invalidation) re-run the bound request
  // without passing through `capture`.
  state.events$
    .pipe(filter((event) => event.type === HttpEventType.Response || event.type === 'error'))
    .subscribe(capture);

  const abort = (cancelPending?: () => void) =>
    untracked(() => {
      const wasLoading = state.loading() !== null;
      const request = state.subtle.request();
      const isRequestActive = !!request?.loading();

      if (!wasLoading && !isRequestActive) return false;

      cancelPending?.();
      aborted$.next();
      request?.subtle.abort();

      // `state.error` is derived from `state.rawResponse`, so a write to the response resets an
      // error set before it. Restore the response first.
      state.rawResponse.set(settled.rawResponse);
      state.error.set(settled.error);
      state.latestHttpEvent.set(settled.latestHttpEvent);
      state.loading.set(null);

      return true;
    });

  return { capture, abort, aborted$: aborted$.asObservable() };
};
