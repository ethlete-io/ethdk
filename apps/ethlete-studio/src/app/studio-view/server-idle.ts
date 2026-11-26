import { Observable, catchError, from, map, of, switchMap, timeout } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

export const SERVER_QUEUE_PATH = '/__design/queue';

/** A check draws in bursts; a gap shorter than this still counts as the same check. */
export const SERVER_QUIET_MS = 30_000;

const QUEUE_TIMEOUT_MS = 5_000;

export type ServerWork = {
  queued?: number;
  rendering?: number;
  working?: number;
  quietMs?: number | null;
};

/** True when no drawing, check or merge runs in the server, nor ran within `SERVER_QUIET_MS`. */
export const serverIdleOf = (work: ServerWork | null) => {
  if (!work) return false;

  const running = (work.queued ?? 0) + (work.rendering ?? 0) + (work.working ?? 0);
  const quiet = work.quietMs === null || work.quietMs === undefined || work.quietMs >= SERVER_QUIET_MS;

  return running === 0 && quiet;
};

/** Whether the server on `port` is idle; an unreadable answer reads as busy. */
export const serverIdle$ = (port: number): Observable<boolean> =>
  fromFetch(`http://localhost:${port}${SERVER_QUEUE_PATH}`).pipe(
    switchMap((response) => (response.ok ? from(response.json() as Promise<ServerWork>) : of(null))),
    map(serverIdleOf),
    timeout(QUEUE_TIMEOUT_MS),
    // eslint-disable-next-line ethlete/no-silent-catch-error -- a server that does not answer is not restarted on its own
    catchError(() => of(false)),
  );
