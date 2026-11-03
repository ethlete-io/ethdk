import { Observable, catchError, distinctUntilChanged, map, of, switchMap, timer } from 'rxjs';
import { designAnswer$ } from './design';

const STALE_MOCKS_POLL_MS = 5000;

export type StaleDesignMocks = { stale: string[]; command: string; message: string };

const sameStale = (a: StaleDesignMocks | null, b: StaleDesignMocks | null) =>
  a?.command === b?.command && a?.stale.join('\n') === b?.stale.join('\n');

/** The stale design mocks the design server on `port` reports, read again every few seconds; null while all are built. */
export const staleDesignMocks$ = (port: number): Observable<StaleDesignMocks | null> =>
  timer(0, STALE_MOCKS_POLL_MS).pipe(
    switchMap(() =>
      designAnswer$<{ stale: StaleDesignMocks | null }>(`http://localhost:${port}/__design/stale-mocks`).pipe(
        map(({ stale }) => stale),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- a server down or older than the route shows no banner; designAnswer$ logs a refusal
        catchError(() => of(null)),
      ),
    ),
    distinctUntilChanged(sameStale),
  );
