import { signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { DEFAULT_EXCLUSION_RULES, applyExclusionRules } from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, defer, exhaustMap, map, of, switchMap, tap, timer } from 'rxjs';
import { WindowBatch, injectHostPorts } from '../host';

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
  const lastRun = signal<WindowCollectorRun | null>(null);
  const totals = signal<WindowCollectorTotals>({ since: new Date(), stored: 0, excluded: 0, dropped: 0 });
  const failure = signal<string | null>(null);
  const status = toSignal(ports.windows.status$().pipe(catchError(() => of(null))), { initialValue: null });

  let throughSeq = 0;

  const store$ = (batch: WindowBatch): Observable<unknown> => {
    const { kept, excluded } = applyExclusionRules({ events: batch.events, rules: DEFAULT_EXCLUSION_RULES });
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

  const collect$ = (): Observable<unknown> =>
    defer(() =>
      ports.windows.batch$(throughSeq).pipe(
        switchMap((batch) => store$(batch)),
        catchError((error: unknown) => {
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
      ),
    );

  timer(0, WINDOW_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => collect$()),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, totals, failure, status };
});

export const injectWindowCollector = /* @__PURE__ */ toInjectFn(WINDOW_COLLECTOR_DEF);
