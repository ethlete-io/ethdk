import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { applyExclusionRules, effectiveExclusionRules } from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, concat, concatMap, defer, exhaustMap, map, switchMap, tap, timer } from 'rxjs';
import { injectTimetrackSettings } from '../app/settings/settings';
import { WindowBatch, WindowSourceStatus, injectHostPorts } from '../host';

export const WINDOW_POLL_INTERVAL_MS = 30_000;

export type WindowCollectorRun = {
  at: Date;
  stored: number;
  excluded: number;
  dropped: number;
};

/**
 * What the collector has drained since the app started.
 *
 * A drain covers half a minute, so the last one is almost always zero even while the source is
 * perfectly healthy — the running total is the number that says whether anything is arriving.
 */
export type WindowCollectorTotals = {
  since: Date;
  stored: number;
  excluded: number;
  dropped: number;
};

/**
 * Drains the host's focus and presence samples and stores the ones no exclusion rule denies.
 *
 * The sequence is only acknowledged once a batch is stored, so a failure repeats it rather than
 * leaving a hole. Titles are matched against the rules before the store is touched — an excluded
 * title must never reach the database, not even to be deleted later.
 */
const WINDOW_COLLECTOR_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const lastRun = signal<WindowCollectorRun | null>(null);
  const totals = signal<WindowCollectorTotals>({ since: new Date(), stored: 0, excluded: 0, dropped: 0 });
  const failure = signal<string | null>(null);
  const status = signal<WindowSourceStatus | null>(null);

  let throughSeq = 0;

  const store$ = (batch: WindowBatch): Observable<unknown> => {
    const { kept, excluded } = applyExclusionRules({
      events: batch.events,
      rules: effectiveExclusionRules(settings.settings()),
    });
    const record = () => {
      throughSeq = batch.throughSeq;
      failure.set(null);
      lastRun.set({
        at: new Date(),
        stored: kept.length,
        excluded: excluded.length,
        dropped: batch.dropped,
      });
      totals.update((all) => ({
        since: all.since,
        stored: all.stored + kept.length,
        excluded: all.excluded + excluded.length,
        dropped: all.dropped + batch.dropped,
      }));
    };

    if (!kept.length) {
      record();

      return EMPTY;
    }

    return ports.events.append$(kept).pipe(
      map(() => batch),
      tap(record),
    );
  };

  /**
   * The status is re-read on every drain rather than once at startup: a permission the user grants
   * while the app runs turns titles on without a restart, and a banner that still names it as missing
   * would send them back to look for a setting they already changed.
   */
  const status$ = (): Observable<unknown> =>
    ports.windows.status$().pipe(
      tap((next) => status.set(next)),
      catchError(() => EMPTY),
    );

  /**
   * Nothing is drained before the settings have been read: a sample the user's own rule denies must not
   * reach the database because the document was still on its way when the first drain ran.
   */
  const collect$ = (): Observable<unknown> =>
    defer(() =>
      settings.ready$.pipe(
        concatMap(() => ports.windows.batch$(throughSeq)),
        switchMap((batch) => store$(batch)),
        catchError((error: unknown) => {
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
      ),
    );

  timer(0, WINDOW_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => concat(status$(), collect$())),
      takeUntilDestroyed(),
    )
    .subscribe();

  /**
   * Asks for the permission window titles need and reads the status back, so the banner clears as soon
   * as it is granted rather than at the next drain.
   */
  const requestAccessibility$ = () =>
    ports.windows.requestAccessibility$().pipe(
      concatMap(() => status$()),
      catchError((error: unknown) => {
        failure.set(error instanceof Error ? error.message : String(error));

        return EMPTY;
      }),
    );

  return { lastRun, totals, failure, status, requestAccessibility$ };
});

export const injectWindowCollector = /* @__PURE__ */ toInjectFn(WINDOW_COLLECTOR_DEF);
