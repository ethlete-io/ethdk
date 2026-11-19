import {
  AgedNaming,
  CheckoutDependencies,
  CollectedEvent,
  CutOptions,
  DayReview,
  DayReviewEdits,
  EMPTY_DAY_REVIEW_EDITS,
  EpicOptions,
  PeerDayRows,
  RecurringPattern,
  StreamDay,
  TimetrackProjectLink,
  TimetrackSettings,
  closeTimerRun,
  coveredMsOf,
  dayBoundaryOf,
  effectiveExclusionRules,
  localDayKey,
  localDayRange,
  mergeDayEvents,
  pinnedOntoDay,
  pauseWindows,
  pausedMs,
  peerHeadBranches,
  readHeadBranches$,
  reviewDay,
  settingsOnDay,
  streamDay,
  unbranchedCheckouts,
} from '@ethlete/timetrack';
import { Observable, catchError, combineLatest, concatMap, defer, map, of } from 'rxjs';
import { HostPorts, NOTHING_RECEIVED } from '../host';
import { streamDayOptionsOf } from './stream-day-options';
import { receivedDayRowsOn, withReceivedSharedRows } from './peers/day-rows';
import { heardChunksOf, transcriptBetween$ } from './transcript-chunks';

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
  /** The rows each paired machine last sent for the day, by machine id, in this machine's lanes. */
  peerRows: Readonly<Record<string, PeerDayRows>>;
};

export type DayReadOptions = {
  ports: HostPorts;
  settings: TimetrackSettings;
  repoRoots: readonly string[];
  links: readonly TimetrackProjectLink[];
  /** Each linked worktree mapped to its main checkout, from the git collector's `worktrees()`. */
  worktrees: Readonly<Record<string, string>>;
  /** Which checkout uses which as a package, from `injectCheckoutDependencies`. */
  dependencies: CheckoutDependencies;
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
    const peerHeads: Record<string, Record<string, string>> = {};
    const asked = new Set<string>();

    return combineLatest({
      events: ports.events.eventsBetween$(from, to),
      edits: ports.review.editsFor$(key),
      runs: ports.timers.runsBetween$(from, to),
      coverage: ports.coverage.forDay$(key),
      received: ports.peers.receivedBetween$(from, to).pipe(catchError(() => of(NOTHING_RECEIVED))),
      transcript: transcriptBetween$({ ports, from, to }),
      timelines: ports.peers.receivedBranchTimelines$().pipe(catchError(() => of([]))),
    }).pipe(
      concatMap(({ events, edits, runs, coverage, received, transcript, timelines }) => {
        const merged = mergeDayEvents({
          local: events,
          received,
          keys: received.ownRepoKeys,
          rules: effectiveExclusionRules(settings),
        });
        const read = () => {
          const at = new Date(Math.min(Date.now(), to.getTime()));
          const pauses = pauseWindows({ events, window: { from, to }, through: at });
          const dayOptions = streamDayOptionsOf({
            repoRoots: options.repoRoots,
            settings,
            links: options.links,
            worktrees: options.worktrees,
            dependencies: options.dependencies,
            patterns: options.patterns,
            epics: options.epics,
            windowsSeenThroughMs: options.windowsSeenThroughMs,
            headBranches: { ...heads },
            peerHeadBranches: { ...peerHeads },
            through: at,
            now: at < to ? at : undefined,
            rows: { timerRuns: runs.map((run) => closeTimerRun(run, at)), pauses },
            heard: heardChunksOf(transcript),
            day: key,
          });
          const day = streamDay({ events: merged, options: dayOptions });
          const reviewWith = (current: DayReviewEdits) =>
            reviewDay({
              rows: day.rows,
              edits: current,
              cut: dayOptions.rows?.cut,
              standIns: settings.standIns,
              rules: settings.attributionRules,
              day: key,
              check: {
                targetMs: settings.dayTargetMs,
                coveredMs: coveredMsOf(coverage),
                pausedMs: pausedMs(pauses),
                ...options.check,
              },
            });
          const stored = pinnedOntoDay({
            edits: withReceivedSharedRows({ edits: edits ?? EMPTY_DAY_REVIEW_EDITS, received, day: key }),
            day: key,
            boundary,
          });

          return {
            key,
            at,
            events,
            day,
            edits: stored,
            cut: dayOptions.rows?.cut,
            review: reviewWith(stored),
            reviewWith,
            peerRows: receivedDayRowsOn({ received, day: key }),
          };
        };
        const first = read();
        const unbranched = unbranchedCheckouts(first.day.streams).filter((repoPath) => !asked.has(repoPath));

        if (!unbranched.length) return of(first);

        unbranched.forEach((repoPath) => asked.add(repoPath));

        const fromPeers = peerHeadBranches({
          events: merged,
          repoPaths: unbranched,
          localKeys: received.ownRepoKeys,
          timelines,
        });

        for (const [machineId, found] of Object.entries(fromPeers.byMachine)) {
          peerHeads[machineId] = { ...peerHeads[machineId], ...found };
        }

        return readHeadBranches$({ processes: ports.processes, repoPaths: fromPeers.local, at: to }).pipe(
          catchError(() => of<Record<string, string>>({})),
          map((found) => {
            Object.assign(heads, found);

            return Object.keys(found).length || Object.keys(fromPeers.byMachine).length ? read() : first;
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
