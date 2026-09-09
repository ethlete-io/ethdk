import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { EMPTY, Observable, catchError, concat, defer, exhaustMap, map, switchMap, tap, timer } from 'rxjs';
import { injectCollectionPause } from '../app/collection-pause';
import { CallBatch, CallSourceStatus, injectHostPorts } from '../host';

export const CALL_POLL_INTERVAL_MS = 30_000;

export type CallCollectorRun = {
  at: Date;
  stored: number;
  dropped: number;
};

/**
 * What the collector has drained since the app started.
 *
 * A call starts and ends a few times a day, so both the last run and the running total read zero on a
 * day with no meeting. That is a healthy source, not a broken one — `status` is what says which.
 */
export type CallCollectorTotals = {
  since: Date;
  stored: number;
  dropped: number;
};

/**
 * Drains the host's microphone edges and stores them.
 *
 * No exclusion rule runs here, and that is the whole reason this is not the window collector: a call
 * event is a presence sample, so denying one before the store would turn an hour in a voice room into
 * absence rather than into unclassified time. Whether a call was work is decided at read time by
 * `TimetrackCallRules`, and it defaults to no. The event carries a process id and an instant and no
 * title, so there is nothing here for a title rule to protect.
 *
 * The sequence is only acknowledged once a batch is stored, so a failure repeats it rather than
 * leaving a hole.
 */
const CALL_COLLECTOR_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const pause = injectCollectionPause();
  const lastRun = signal<CallCollectorRun | null>(null);
  const totals = signal<CallCollectorTotals>({ since: new Date(), stored: 0, dropped: 0 });
  const failure = signal<string | null>(null);
  const status = signal<CallSourceStatus | null>(null);

  let throughSeq = 0;

  const store$ = (batch: CallBatch): Observable<unknown> => {
    const record = () => {
      throughSeq = batch.throughSeq;
      failure.set(null);
      lastRun.set({ at: new Date(), stored: batch.events.length, dropped: batch.dropped });
      totals.update((all) => ({
        since: all.since,
        stored: all.stored + batch.events.length,
        dropped: all.dropped + batch.dropped,
      }));
    };

    if (!batch.events.length) {
      record();

      return EMPTY;
    }

    return ports.events.append$(batch.events).pipe(
      map(() => batch),
      tap(record),
    );
  };

  const status$ = (): Observable<unknown> =>
    ports.calls.status$().pipe(
      tap((next) => status.set(next)),
      catchError(() => EMPTY),
    );

  const collect$ = (): Observable<unknown> =>
    defer(() =>
      ports.calls.batch$(throughSeq).pipe(
        switchMap((batch) => store$(batch)),
        catchError((error: unknown) => {
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
      ),
    );

  /**
   * A paused collector does nothing at all, the host's own buffer included. The host stopped watching
   * the microphone when the pause was recorded, and it forgot who was holding it, so a call that
   * outlives the pause is seen to start again at the resume rather than arriving as a bare end.
   */
  timer(0, CALL_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => (pause.isPaused() ? EMPTY : concat(status$(), collect$()))),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, totals, failure, status };
});

export const injectCallCollector = /* @__PURE__ */ toInjectFn(CALL_COLLECTOR_DEF);
