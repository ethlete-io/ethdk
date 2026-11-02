import { Observable, catchError, concatMap, distinctUntilChanged, filter, map, merge, of, pairwise } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { designEvents$ } from './design-events';

export const DESIGN_STAMP_PATH = '/__design/stamp';

const pidOf = (stamp: unknown) => {
  const pid = (stamp as { pid?: unknown } | null)?.pid;

  return typeof pid === 'number' ? pid : null;
};

export const designServerPid$ = (port: number): Observable<number | null> =>
  fromFetch(`http://localhost:${port}${DESIGN_STAMP_PATH}`, {
    cache: 'no-store',
    selector: (response) => response.json() as Promise<unknown>,
  }).pipe(
    map(pidOf),
    // eslint-disable-next-line ethlete/no-silent-catch-error -- an unreadable stamp leaves the last known pid in place
    catchError(() => of(null)),
  );

/** Emits when another process answers on `port` than before, read at start and at every reconnect of the event stream. */
export const designServerReplaced$ = (port: number): Observable<void> =>
  merge(of(null), designEvents$(port, 'open')).pipe(
    concatMap(() => designServerPid$(port)),
    filter((pid): pid is number => pid !== null),
    distinctUntilChanged(),
    pairwise(),
    map(() => undefined),
  );
