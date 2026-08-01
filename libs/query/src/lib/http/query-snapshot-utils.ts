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
 * The promise stays pending if the execution is cancelled (e.g. `reset()`) and the query is never
 * executed again - the snapshot settles with whichever execution completes next.
 */
export const executeUntilSettled = async <TArgs extends QueryArgs>(
  query: Query<TArgs>,
  executeArgs?: QueryExecuteArgs<TArgs>,
): Promise<QuerySnapshot<TArgs>> => {
  query.execute(executeArgs);

  const snapshot = query.createSnapshot();

  await firstValueFrom(snapshot.isAlive.asObservable().pipe(filter((isAlive) => !isAlive)));

  return snapshot;
};
