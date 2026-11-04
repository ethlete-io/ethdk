import { Observable, catchError, defer, map, of, switchMap, tap } from 'rxjs';

export type KeptRead<T> = { items: T; error: string | null };

/** Re-reads on every ask; a failed read keeps the last good items of the same subject and carries the error. */
export const keptRead$ =
  <TAsk, T>(options: { read: (asked: TAsk) => Observable<T>; empty: T; subjectOf?: (asked: TAsk) => unknown }) =>
  (asked$: Observable<TAsk>): Observable<KeptRead<T>> =>
    defer(() => {
      let items = options.empty;
      let subject: unknown = null;

      return asked$.pipe(
        switchMap((asked) => {
          const askedSubject = options.subjectOf?.(asked) ?? null;

          return options.read(asked).pipe(
            tap((read) => {
              items = read;
              subject = askedSubject;
            }),
            map((read): KeptRead<T> => ({ items: read, error: null })),
            catchError((error) =>
              of<KeptRead<T>>({
                items: subject === askedSubject ? items : options.empty,
                error: error instanceof Error ? error.message : String(error),
              }),
            ),
          );
        }),
      );
    });
