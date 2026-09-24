import { untracked } from '@angular/core';
import { defaultIfEmpty, defer, filter, finalize, firstValueFrom, map, Observable, take } from 'rxjs';
import { Query, QueryArgs, QuerySnapshot } from './query';
import { QueryExecuteArgs } from './query-execute';

/**
 * Executes the query on subscribe and emits once that execution has settled (response or error
 * received), then completes. Cold: nothing is sent until it is subscribed to. The emitted snapshot is
 * frozen to that execution, so a later execution can't swap the `response()` / `error()` you read.
 *
 * Unsubscribing before it settles aborts the in-flight request, like unsubscribing from `HttpClient`.
 *
 * A cancelled execution settles too - the entry was evicted, unbound by a logout, or the scope that
 * owns the query was destroyed. The snapshot then reports the execution as a failure whose error
 * says the request was cancelled, and its `latestHttpEvent()` is `{ type: 'cancel' }`.
 */
export const executeUntilSettled$ = <TArgs extends QueryArgs>(
  query: Query<TArgs>,
  executeArgs?: QueryExecuteArgs<TArgs>,
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
      finalize(() =>
        untracked(() => {
          if (snapshot.isAlive()) query.subtle.request()?.subtle.abort();
        }),
      ),
    );
  });

/**
 * The Promise form of {@link executeUntilSettled$}, for APIs that require an `async` function - e.g. a
 * signal-forms `submit()` action mapping server violations onto the form via
 * `mapViolationsToFormErrors`. Executes immediately. Prefer {@link executeUntilSettled$} in RxJS code.
 */
export const executeUntilSettled = <TArgs extends QueryArgs>(
  query: Query<TArgs>,
  executeArgs?: QueryExecuteArgs<TArgs>,
): Promise<QuerySnapshot<TArgs>> => firstValueFrom(executeUntilSettled$(query, executeArgs));
