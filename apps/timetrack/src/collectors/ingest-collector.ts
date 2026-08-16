import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { applyExclusionRules, effectiveExclusionRules, parseIngestedRecords, rejectedCount } from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, concat, concatMap, defer, exhaustMap, map, switchMap, tap, timer } from 'rxjs';
import { injectCollectionPause } from '../app/collection-pause';
import { injectTimetrackSettings } from '../app/settings/settings';
import { IngestBatch, IngestStatus, injectHostPorts } from '../host';

export const INGEST_POLL_INTERVAL_MS = 30_000;

export type IngestCollectorRun = {
  at: Date;
  stored: number;
  excluded: number;
  dropped: number;
  /** Records no reporter should have posted — an unknown kind, a bad instant, a shape with no work in it. */
  rejected: number;
};

/**
 * What the collector has drained since the app started.
 *
 * A drain covers half a minute, so the last one says little on its own — the running total is the
 * number that says whether a reporter is arriving at all.
 */
export type IngestCollectorTotals = {
  since: Date;
  stored: number;
  excluded: number;
  dropped: number;
  rejected: number;
};

/**
 * Drains what reporters posted to the local endpoint and stores the events no exclusion rule denies.
 *
 * The sequence is only acknowledged once a batch is stored, so a failure repeats it rather than
 * leaving a hole. A record is interpreted here and nowhere earlier: the host buffers what a reporter
 * wrote without looking inside it, so this is the only place a posted shape becomes an event.
 */
const INGEST_COLLECTOR_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const pause = injectCollectionPause();
  const lastRun = signal<IngestCollectorRun | null>(null);
  const totals = signal<IngestCollectorTotals>({ since: new Date(), stored: 0, excluded: 0, dropped: 0, rejected: 0 });
  const failure = signal<string | null>(null);
  const status = signal<IngestStatus | null>(null);

  let throughSeq = 0;

  const store$ = (batch: IngestBatch): Observable<unknown> => {
    const parsed = parseIngestedRecords({ records: batch.records, now: new Date() });
    const { kept, excluded } = applyExclusionRules({
      events: parsed.events,
      rules: effectiveExclusionRules(settings.settings()),
    });
    const rejected = rejectedCount(parsed.rejected);
    const record = () => {
      throughSeq = batch.throughSeq;
      failure.set(null);
      lastRun.set({ at: new Date(), stored: kept.length, excluded: excluded.length, dropped: batch.dropped, rejected });
      totals.update((all) => ({
        since: all.since,
        stored: all.stored + kept.length,
        excluded: all.excluded + excluded.length,
        dropped: all.dropped + batch.dropped,
        rejected: all.rejected + rejected,
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

  const status$ = (): Observable<unknown> =>
    ports.ingest.status$().pipe(
      tap((next) => status.set(next)),
      catchError(() => EMPTY),
    );

  /**
   * Nothing is drained before the settings have been read: a path the user's own rule denies must not
   * reach the database because the document was still on its way when the first drain ran.
   */
  const collect$ = (): Observable<unknown> =>
    defer(() =>
      settings.ready$.pipe(
        concatMap(() => ports.ingest.batch$(throughSeq)),
        switchMap((batch) => store$(batch)),
        catchError((error: unknown) => {
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
      ),
    );

  /**
   * A paused collector drains nothing, the host's buffer included. The endpoint stopped keeping what
   * reporters post when the pause was recorded, so there is nothing in it that a resume must not take.
   */
  timer(0, INGEST_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => (pause.isPaused() ? EMPTY : concat(status$(), collect$()))),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, totals, failure, status };
});

export const injectIngestCollector = /* @__PURE__ */ toInjectFn(INGEST_COLLECTOR_DEF);
