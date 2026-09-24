import { combineLatest, map, Observable } from 'rxjs';
import { ToolkitError } from './toolkit-types';

/** Emits `true` while any of the given loading streams is `true`. Nullish entries are skipped. */
export const joinLoading = (observables: (Observable<boolean | null> | null | undefined)[]): Observable<boolean> =>
  combineLatest(observables.filter((o): o is Observable<boolean | null> => !!o)).pipe(
    map((values) => values.some((value) => !!value)),
  );

/** Emits every non-null error of the given error streams, or `null` when there is none. Nullish entries are skipped. */
export const joinErrors = (
  observables: (Observable<ToolkitError | null> | null | undefined)[],
): Observable<ToolkitError[] | null> =>
  combineLatest(observables.filter((o): o is Observable<ToolkitError | null> => !!o)).pipe(
    map((values) => {
      const errors = values.filter((value): value is ToolkitError => !!value);

      return errors.length ? errors : null;
    }),
  );
