import {
  CollectedEvent,
  DayCorrelation,
  DayReview,
  EMPTY_DAY_REVIEW_EDITS,
  TimetrackSettings,
  closeTimerRun,
  correlateDay,
  coveredMsOf,
  gitFlowConfigFor,
  localDayKey,
  localDayRange,
  pauseWindows,
  reviewDay,
} from '@ethlete/timetrack';
import { Observable, combineLatest, map } from 'rxjs';
import { HostPorts } from '../host';

export type DayRead = {
  key: string;
  /** The instant the day is read through: now, or the day's end once it is over. */
  at: Date;
  events: CollectedEvent[];
  correlation: DayCorrelation;
  review: DayReview;
};

export type DayReadOptions = {
  ports: HostPorts;
  settings: TimetrackSettings;
  repoRoots: readonly string[];
};

/**
 * One day, reconstructed from the store, for every surface that reads a day it does not own: the tray
 * menu, the end-of-day reminder and the week view all do. The day review has its own reader because it
 * also carries the reviewer's unsaved edits.
 *
 * A read rather than a store. Each caller already owns a clock or an anchor of its own, and one shared
 * subscription would make each of them wait for the others.
 */
export const readDay$ = (options: DayReadOptions & { day: string }): Observable<DayRead> => {
  const { ports, settings, day: key } = options;
  const { from, to } = localDayRange(key);

  return combineLatest({
    events: ports.events.eventsBetween$(from, to),
    edits: ports.review.editsFor$(key),
    runs: ports.timers.runsBetween$(from, to),
    coverage: ports.coverage.forDay$(key),
  }).pipe(
    map(({ events, edits, runs, coverage }) => {
      const at = new Date(Math.min(Date.now(), to.getTime()));
      const correlation = correlateDay({
        events,
        timerRuns: runs.map((run) => closeTimerRun(run, at)),
        pauses: pauseWindows({ events, window: { from, to }, through: at }),
        config: gitFlowConfigFor(settings),
        rules: settings.attributionRules,
        links: settings.projectLinks,
        sessionize: { repoRoots: [...options.repoRoots] },
        fill: { maxFillGapMs: settings.gapFillMs },
      });

      return {
        key,
        at,
        events,
        correlation,
        review: reviewDay({
          correlation,
          edits: edits ?? EMPTY_DAY_REVIEW_EDITS,
          check: { targetMs: settings.dayTargetMs, coveredMs: coveredMsOf(coverage) },
        }),
      };
    }),
  );
};

/**
 * Today, for the two surfaces that must report today whatever day the review is on: the tray readout
 * and the end-of-day reminder both do, and the review follows whichever day the reviewer stepped to.
 */
export const readToday$ = (options: DayReadOptions): Observable<DayRead> =>
  readDay$({ ...options, day: localDayKey(new Date()) });
