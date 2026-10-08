import {
  AgedNaming,
  CollectedEvent,
  CutOptions,
  DayReview,
  DayReviewEdits,
  EMPTY_DAY_REVIEW_EDITS,
  EpicOptions,
  RecurringPattern,
  StreamDay,
  TimetrackProjectLink,
  TimetrackSettings,
  closeTimerRun,
  coveredMsOf,
  dayBoundaryOf,
  localDayKey,
  localDayRange,
  pinnedOntoDay,
  pauseWindows,
  pausedMs,
  readHeadBranches$,
  reviewDay,
  settingsOnDay,
  streamDay,
  unbranchedCheckouts,
} from '@ethlete/timetrack';
import { Observable, catchError, combineLatest, concatMap, defer, map, of } from 'rxjs';
import { HostPorts } from '../host';
import { streamDayOptionsOf } from './stream-day-options';

export type DayRead = {
  key: string;
  /** The instant the day is read through: now, or the day's end once it is over. */
  at: Date;
  events: CollectedEvent[];
  day: StreamDay;
  edits: DayReviewEdits;
  cut?: CutOptions;
  review: DayReview;
  reviewWith: (edits: DayReviewEdits) => DayReview;
};

export type DayReadOptions = {
  ports: HostPorts;
  settings: TimetrackSettings;
  repoRoots: readonly string[];
  links: readonly TimetrackProjectLink[];
  /** Each linked worktree mapped to its main checkout, from the git collector's `worktrees()`. */
  worktrees: Readonly<Record<string, string>>;
  /** The standing commitments the user's Tempo history holds, from `injectRecurringPatterns`. */
  patterns?: readonly RecurringPattern[];
  /**
   * The instant the window source has reported through, which is its last drain rather than now.
   *
   * Reading it as now would let a dead collector's last focus sample grow by half an hour, and the
   * tray would report presence rising on a machine that observes nothing.
   */
  windowsSeenThroughMs?: number;
  /** What a sibling checkout on the same branch name books, from `readEpicOptions$`. */
  epics?: EpicOptions;
  /** What only the day screen reads for its warnings: the aged namings and whether the day is over. */
  check?: { agedNamings?: readonly AgedNaming[]; finished?: boolean };
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
  const { ports, day: key } = options;
  const settings = settingsOnDay({ settings: options.settings, day: key });
  const boundary = dayBoundaryOf(settings);
  const { from, to } = localDayRange(key, boundary);

  return defer(() => {
    const heads: Record<string, string> = {};
    const asked = new Set<string>();

    return combineLatest({
      events: ports.events.eventsBetween$(from, to),
      edits: ports.review.editsFor$(key),
      runs: ports.timers.runsBetween$(from, to),
      coverage: ports.coverage.forDay$(key),
      received: ports.peers.receivedBetween$(from, to).pipe(
        map((range) => range.events),
        catchError(() => of([])),
      ),
    }).pipe(
      concatMap(({ events, edits, runs, coverage, received }) => {
        const read = () => {
          const at = new Date(Math.min(Date.now(), to.getTime()));
          const pauses = pauseWindows({ events, window: { from, to }, through: at });
          const dayOptions = streamDayOptionsOf({
            repoRoots: options.repoRoots,
            settings,
            links: options.links,
            worktrees: options.worktrees,
            patterns: options.patterns,
            epics: options.epics,
            windowsSeenThroughMs: options.windowsSeenThroughMs,
            headBranches: { ...heads },
            through: at,
            now: at < to ? at : undefined,
            rows: { timerRuns: runs.map((run) => closeTimerRun(run, at)), pauses, received },
          });
          const day = streamDay({ events, options: dayOptions });
          const reviewWith = (current: DayReviewEdits) =>
            reviewDay({
              rows: day.rows,
              edits: current,
              cut: dayOptions.rows?.cut,
              standIns: settings.standIns,
              rules: settings.attributionRules,
              check: {
                targetMs: settings.dayTargetMs,
                coveredMs: coveredMsOf(coverage),
                pausedMs: pausedMs(pauses),
                ...options.check,
              },
            });
          const stored = pinnedOntoDay({ edits: edits ?? EMPTY_DAY_REVIEW_EDITS, day: key, boundary });

          return {
            key,
            at,
            events,
            day,
            edits: stored,
            cut: dayOptions.rows?.cut,
            review: reviewWith(stored),
            reviewWith,
          };
        };
        const first = read();
        const missing = unbranchedCheckouts(first.day.streams).filter((repoPath) => !asked.has(repoPath));

        if (!missing.length) return of(first);

        missing.forEach((repoPath) => asked.add(repoPath));

        return readHeadBranches$({ processes: ports.processes, repoPaths: missing, at: to }).pipe(
          catchError(() => of<Record<string, string>>({})),
          map((found) => {
            Object.assign(heads, found);

            return Object.keys(found).length ? read() : first;
          }),
        );
      }),
    );
  });
};

/**
 * Today, for the two surfaces that must report today whatever day the review is on: the tray readout
 * and the end-of-day reminder both do, and the review follows whichever day the reviewer stepped to.
 */
export const readToday$ = (options: DayReadOptions): Observable<DayRead> =>
  readDay$({ ...options, day: localDayKey(new Date(), dayBoundaryOf(options.settings)) });
