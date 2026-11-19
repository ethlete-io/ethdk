import { CheckoutBranchTimeline, CheckoutKeys, encodeBranchTimelines } from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, concatMap, distinctUntilChanged, exhaustMap, switchMap, take } from 'rxjs';

/** On each tick, reads this machine's branch timelines and sends them once they changed. */
export const sendBranchTimelines$ = (options: {
  tick$: Observable<unknown>;
  ownKeys$: () => Observable<CheckoutKeys>;
  read$: (keys: CheckoutKeys) => Observable<CheckoutBranchTimeline[]>;
  send$: (checkouts: readonly CheckoutBranchTimeline[]) => Observable<void>;
}): Observable<void> =>
  options.tick$.pipe(
    exhaustMap(() =>
      options.ownKeys$().pipe(
        take(1),
        switchMap((keys) => options.read$(keys).pipe(take(1))),
        catchError(() => EMPTY),
      ),
    ),
    distinctUntilChanged((left, right) => encodeBranchTimelines(left) === encodeBranchTimelines(right)),
    concatMap((checkouts) =>
      options.send$(checkouts).pipe(
        take(1),
        catchError(() => EMPTY),
      ),
    ),
  );
