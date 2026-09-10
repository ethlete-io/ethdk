import {
  CollectedEvent,
  DayReview,
  EMPTY_DAY_REVIEW_EDITS,
  RecurringPattern,
  StreamDay,
  TimetrackSettings,
  closeTimerRun,
  coveredMsOf,
  dayBoundaryOf,
  localDayKey,
  localDayRange,
  pauseWindows,
  pausedMs,
  reviewDay,
  streamDay,
} from '@ethlete/timetrack';
import { Observable, combineLatest, map } from 'rxjs';
import { HostPorts } from '../host';
import { streamDayOptionsOf } from './stream-day-options';

export type DayRead = {
  key: string;
  /** The instant the day is read through: now, or the day's end once it is over. */
  at: Date;
  events: CollectedEvent[];
  day: StreamDay;
  review: DayReview;
};

export type DayReadOptions = {
  ports: HostPorts;
  settings: TimetrackSettings;
  repoRoots: readonly string[];
  /** The standing commitments the user's Tempo history holds, from `injectRecurringPatterns`. */
  patterns?: readonly RecurringPattern[];
  /**
   * The instant the window source has reported through, which is its last drain rather than now.
   *
   * Reading it as now would let a dead collector's last focus sample grow by half an hour, and the
   * tray would report presence rising on a machine that observes nothing.
   */
  windowsSeenThroughMs?: number;
};

/**
 * One day, reconstructed from the store, for every surface that reads a day it does not own: the tray
 * menu, the end-of-day reminder and the week view all do. The day screen has its own reader because it
 * also carries the reviewer's unsaved edits.
 *
 * A read rather than a store. Each caller already owns a clock or an anchor of its own, and one shared
 * subscription would make each of them wait for the others.
 */
export const readDay$ = (options: DayReadOptions & { day: string }): Observable<DayRead> => {
  const { ports, settings, day: key } = options;
  const boundary = dayBoundaryOf(settings);
  const { from, to } = localDayRange(key, boundary);

  return combineLatest({
    events: ports.events.eventsBetween$(from, to),
    edits: ports.review.editsFor$(key),
    runs: ports.timers.runsBetween$(from, to),
    coverage: ports.coverage.forDay$(key),
  }).pipe(
    map(({ events, edits, runs, coverage }) => {
      const at = new Date(Math.min(Date.now(), to.getTime()));
      const pauses = pauseWindows({ events, window: { from, to }, through: at });
      const day = streamDay({
        events,
        options: streamDayOptionsOf({
          repoRoots: options.repoRoots,
          settings,
          patterns: options.patterns,
          windowsSeenThroughMs: options.windowsSeenThroughMs,
          rows: { timerRuns: runs.map((run) => closeTimerRun(run, at)), pauses },
        }),
      });

      return {
        key,
        at,
        events,
        day,
        review: reviewDay({
          rows: day.rows,
          edits: edits ?? EMPTY_DAY_REVIEW_EDITS,
          check: { targetMs: settings.dayTargetMs, coveredMs: coveredMsOf(coverage), pausedMs: pausedMs(pauses) },
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
  readDay$({ ...options, day: localDayKey(new Date(), dayBoundaryOf(options.settings)) });
