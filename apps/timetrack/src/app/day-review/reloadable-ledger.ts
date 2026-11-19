import { SyncedWorklog } from '@ethlete/timetrack';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';

/**
 * The ledger entries of the day on screen, read again each time `reload$` fires. A sync writes the ledger after
 * the day was read, so without the re-read the day sends its rows to paired machines as if nothing were booked.
 */
export const reloadableLedger$ = (options: {
  day$: Observable<string>;
  reload$: Observable<void>;
  read$: (day: string) => Observable<SyncedWorklog[]>;
}): Observable<{ key: string; entries: SyncedWorklog[] }> =>
  options.day$.pipe(
    switchMap((key) =>
      options.reload$.pipe(
        startWith(undefined),
        switchMap(() =>
          options.read$(key).pipe(
            catchError(() => of<SyncedWorklog[]>([])),
            map((entries) => ({ key, entries })),
          ),
        ),
      ),
    ),
  );
