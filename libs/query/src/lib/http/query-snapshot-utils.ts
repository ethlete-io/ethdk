import { untracked } from '@angular/core';
import { defaultIfEmpty, defer, filter, finalize, firstValueFrom, map, Observable, take } from 'rxjs';
import { Query, QueryArgs, QuerySnapshot } from './query';
import { QueryExecuteArgs } from './query-execute';

const isAbortedSnapshot = (snapshot: QuerySnapshot<QueryArgs>) =>
  snapshot.latestHttpEvent()?.type === 'cancel' && snapshot.error() === null;

const executeAndSettle$ = <TArgs extends QueryArgs>(
  query: Query<TArgs>,
  executeArgs: QueryExecuteArgs<TArgs> | undefined,
  emitAborted: boolean,
): Observable<QuerySnapshot<TArgs>> =>
  defer(() => {
    query.execute(executeArgs);

    const snapshot = query.createSnapshot();

    return snapshot.isAlive.asObservable().pipe(
      filter((isAlive) => !isAlive),
      take(1),
      // The stream completes without emitting when the query's injector is torn down mid-execution.
      defaultIfEmpty(false),
      map(() => snapshot),
      filter((settled) => emitAborted || !untracked(() => isAbortedSnapshot(settled))),
      finalize(() =>
        untracked(() => {
          if (snapshot.isAlive()) query.abort();
        }),
      ),
    );
  });

/**
 * Executes the query on subscribe and emits once that execution has settled (response or error
 * received), then completes. Cold: nothing is sent until it is subscribed to. The emitted snapshot is
 * frozen to that execution, so a later execution can't swap the `response()` / `error()` you read.
 *
 * Unsubscribing before it settles aborts the execution like `query.abort()`, the way unsubscribing
 * from `HttpClient` cancels its request. An execution stopped by `query.abort()` completes the stream
 * without a value.
 *
 * A cancelled execution settles too - the entry was evicted, unbound by a logout, or the scope that
 * owns the query was destroyed. The snapshot then reports the execution as a failure whose error
 * says the request was cancelled, and its `latestHttpEvent()` is `{ type: 'cancel' }`.
 */
export const executeUntilSettled$ = <TArgs extends QueryArgs>(
  query: Query<TArgs>,
  executeArgs?: QueryExecuteArgs<TArgs>,
): Observable<QuerySnapshot<TArgs>> => executeAndSettle$(query, executeArgs, false);

/**
 * The Promise form of {@link executeUntilSettled$}, for APIs that require an `async` function - e.g. a
 * signal-forms `submit()` action mapping server violations onto the form via
 * `mapViolationsToFormErrors`. Executes immediately. Prefer {@link executeUntilSettled$} in RxJS code.
 *
 * An execution stopped by `query.abort()` resolves with a snapshot that has no response, no error, a
 * `null` `executionState()` and `latestHttpEvent()` `{ type: 'cancel' }`.
 */
export const executeUntilSettled = <TArgs extends QueryArgs>(
  query: Query<TArgs>,
  executeArgs?: QueryExecuteArgs<TArgs>,
): Promise<QuerySnapshot<TArgs>> => firstValueFrom(executeAndSettle$(query, executeArgs, true));
