import { Observable, catchError, expand, of, switchMap, timer } from 'rxjs';
import { designAnswer$ } from './design';

export type DrawFailure = { part: string; state: string; status: number; message: string; at: string };

export type DesignQueue = {
  queued: number;
  rendering: number;
  oldestMs: number | null;
  failedTotal: number;
  failed: DrawFailure[];
};

export const BUSY_QUEUE_POLL_MS = 1000;

export const IDLE_QUEUE_POLL_MS = 5000;

const queue$ = (port: number) =>
  designAnswer$<DesignQueue>(`http://localhost:${port}/__design/queue`).pipe(catchError(() => of(null)));

/** Polls the render queue of the design server on `port`, every second while it draws and slower while idle. */
export const designQueue$ = (port: number): Observable<DesignQueue | null> =>
  queue$(port).pipe(
    expand((queue) =>
      timer(queue && queue.queued + queue.rendering > 0 ? BUSY_QUEUE_POLL_MS : IDLE_QUEUE_POLL_MS).pipe(
        switchMap(() => queue$(port)),
      ),
    ),
  );
