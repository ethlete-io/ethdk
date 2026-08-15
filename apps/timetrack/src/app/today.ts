import {
  CollectedEvent,
  DayCorrelation,
  DayReview,
  EMPTY_DAY_REVIEW_EDITS,
  TimetrackSettings,
  closeTimerRun,
  correlateDay,
  gitFlowConfigFor,
  localDayKey,
  localDayRange,
  pauseWindows,
  reviewDay,
} from '@ethlete/timetrack';
import { Observable, combineLatest, map } from 'rxjs';
import { HostPorts } from '../host';

export type TodayReview = {
  key: string;
  /** The instant the day is read through: now, or midnight once the day has rolled over. */
  at: Date;
  events: CollectedEvent[];
  correlation: DayCorrelation;
  review: DayReview;
};

/**
 * Today, reconstructed from the store, for the surfaces that must report today whatever day the review
 * is on: the tray menu and the end-of-day reminder both do, and the review follows whichever day the
 * reviewer stepped to.
 *
 * A read rather than a store. Both callers already own a clock of their own, and one shared
 * subscription would make each of them wait for the other's tick.
 */
export const readToday$ = (options: {
  ports: HostPorts;
  settings: TimetrackSettings;
  repoRoots: readonly string[];
}): Observable<TodayReview> => {
  const { ports, settings } = options;
  const key = localDayKey(new Date());
  const { from, to } = localDayRange(key);

  return combineLatest({
    events: ports.events.eventsBetween$(from, to),
    edits: ports.review.editsFor$(key),
    runs: ports.timers.runsBetween$(from, to),
  }).pipe(
    map(({ events, edits, runs }) => {
      const at = new Date(Math.min(Date.now(), to.getTime()));
      const correlation = correlateDay({
        events,
        timerRuns: runs.map((run) => closeTimerRun(run, at)),
        pauses: pauseWindows({ events, window: { from, to }, through: at }),
        config: gitFlowConfigFor(settings),
        rules: settings.attributionRules,
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
          check: { targetMs: settings.dayTargetMs },
        }),
      };
    }),
  );
};
