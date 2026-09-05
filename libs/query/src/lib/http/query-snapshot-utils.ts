import { filter, firstValueFrom } from 'rxjs';
import { Query, QueryArgs, QuerySnapshot } from './query';
import { QueryExecuteArgs } from './query-execute';

/**
 * Executes the query and resolves once that execution has settled (response or error received).
 * The returned snapshot is frozen to the awaited execution, so a later execution can't swap the
 * `response()` / `error()` you read from it.
 *
 * Designed for imperative flows that need a mutation's outcome in place - e.g. a signal-forms
 * `submit()` action mapping server violations onto the form via `mapViolationsToFormErrors`.
 *
 * A cancelled execution settles too - the entry was evicted, unbound by a logout, or the scope that
 * owns the query was destroyed. The snapshot then reports the execution as a failure whose error
 * says the request was cancelled, and its `latestHttpEvent()` is `{ type: 'cancel' }`.
 */
export const executeUntilSettled = async <TArgs extends QueryArgs>(
  query: Query<TArgs>,
  executeArgs?: QueryExecuteArgs<TArgs>,
): Promise<QuerySnapshot<TArgs>> => {
  query.execute(executeArgs);

  const snapshot = query.createSnapshot();

  // The stream completes without emitting when the query's injector is torn down mid-execution;
  // without a default `firstValueFrom` rejects with an rxjs `EmptyError` nobody catches.
  await firstValueFrom(snapshot.isAlive.asObservable().pipe(filter((isAlive) => !isAlive)), { defaultValue: false });

  return snapshot;
};
