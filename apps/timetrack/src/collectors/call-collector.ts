import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { closeAbandonedCalls } from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, concat, concatMap, defer, exhaustMap, switchMap, tap, timer } from 'rxjs';
import { injectCollectionPause } from '../app/collection-pause';
import { CallBatch, CallSourceStatus, injectHostPorts } from '../host';

export const CALL_POLL_INTERVAL_MS = 30_000;

/**
 * How far back the startup repair looks for a call a killed run left open.
 *
 * A week, because the app being closed over one is the ordinary case this exists for, and the read is
 * made once per run.
 */
export const CALL_ABANDON_LOOKBACK_MS = 7 * 24 * 60 * 60_000;

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

  const startedAt = new Date();

  const store$ = (batch: CallBatch): Observable<unknown> => {
    const record = (stored: number) => {
      throughSeq = batch.throughSeq;
      failure.set(null);
      lastRun.set({ at: new Date(), stored, dropped: batch.dropped });
      totals.update((all) => ({
        since: all.since,
        stored: all.stored + stored,
        dropped: all.dropped + batch.dropped,
      }));
    };

    if (!batch.events.length) {
      record(0);

      return EMPTY;
    }

    return ports.events.appendCounted$(batch.events).pipe(tap(record));
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
   * Closes what the run before this one left open, before a single edge of this run is drained.
   *
   * The host watches the microphone from inside this process, so a run that is killed mid-call writes
   * no end and `classifyCalls` runs that call to now. It repairs the store rather than the reading
   * because every later read of that day would otherwise have to guess the same thing again.
   *
   * A pause does not stop it. It only ever ends a call, so it can shorten a day and never lengthen one.
   */
  const repair$ = (): Observable<unknown> =>
    defer(() =>
      ports.events.eventsBetween$(new Date(startedAt.getTime() - CALL_ABANDON_LOOKBACK_MS), startedAt).pipe(
        concatMap((events) => {
          const ends = closeAbandonedCalls({ events, startedAt });

          return ends.length ? ports.events.append$(ends) : EMPTY;
        }),
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
  concat(
    repair$(),
    timer(0, CALL_POLL_INTERVAL_MS).pipe(exhaustMap(() => (pause.isPaused() ? EMPTY : concat(status$(), collect$())))),
  )
    .pipe(takeUntilDestroyed())
    .subscribe();

  return { lastRun, totals, failure, status };
});

export const injectCallCollector = /* @__PURE__ */ toInjectFn(CALL_COLLECTOR_DEF);
