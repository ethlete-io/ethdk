import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  CurrentActivity,
  DayCheck,
  EMPTY_DAY_REVIEW_EDITS,
  TimerRun,
  closeTimerRun,
  correlateDay,
  currentActivity,
  formatDurationMs,
  gitFlowConfigFor,
  localDayKey,
  localDayRange,
  pauseWindows,
  reviewDay,
} from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, combineLatest, concatMap, distinctUntilChanged, map, merge, timer } from 'rxjs';
import {
  injectAgentSessionCollector,
  injectCalendarCollector,
  injectGitCollector,
  injectWindowCollector,
} from '../collectors';
import { TrayReadout, injectHostPorts } from '../host';
import { injectCollectionPause } from './collection-pause';
import { formatBlockLabel, formatClockTime } from './day-review/format';
import { injectTimetrackSettings } from './settings/settings';
import { injectTimer } from './timer';

/**
 * How often the readout is rebuilt even though nothing was collected.
 *
 * The collectors are what normally move it, but a day that rolls over midnight and a stretch spent
 * reading in one window both change what the tray should say without producing a single event.
 */
const TRAY_READOUT_INTERVAL_MS = 60_000;

const formatActivity = (activity: CurrentActivity) => {
  if (activity.state === 'paused') return `Paused since ${formatClockTime(activity.since)}`;
  if (activity.state === 'idle') return `Idle since ${formatClockTime(activity.since)}`;
  if (activity.state === 'working') {
    return `${formatBlockLabel(activity.block)} since ${formatClockTime(activity.since)}`;
  }

  return 'Nothing observed today';
};

/**
 * The unattributed half has to be in the readout, not only in the review.
 *
 * A day whose branches carry no issue key proposes nothing at all, and a tray reporting `0m` on such a
 * day reads as "the collectors are broken" when what happened is that six hours of real work matched
 * no ticket.
 */
const formatTotal = (options: { check: DayCheck; targetMs: number }) => {
  const { check } = options;
  const against = `${formatDurationMs(check.proposedMs)} of a ${formatDurationMs(options.targetMs)} target`;

  return check.unattributedMs > 0 ? `${against}, ${formatDurationMs(check.unattributedMs)} unattributed` : against;
};

/** The timer entry is the one menu item that acts, so it has to read as the action it will perform. */
const formatTimer = (options: { running: TimerRun | null; elapsedMs: number }) =>
  options.running ? `Stop timer — ${formatDurationMs(options.elapsedMs)}` : 'Start timer';

/** The same for the pause entry, and the same rule: the label is the action, not the state. */
const formatPause = (options: { isPaused: boolean; pausedForMs: number }) =>
  options.isPaused ? `Resume collection — paused ${formatDurationMs(options.pausedForMs)}` : 'Pause collection';

/**
 * Keeps the tray menu saying what today looks like, whether or not the window is open.
 *
 * It reconstructs today itself rather than reading the day review's: the review follows whichever day
 * the reviewer stepped to, and a tray that reports last Tuesday is worse than one that reports nothing.
 */
const TRAY_READOUT_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const windows = injectWindowCollector();
  const git = injectGitCollector();
  const agentSessions = injectAgentSessionCollector();
  const calendar = injectCalendarCollector();
  const timers = injectTimer();
  const pause = injectCollectionPause();
  const settings = injectTimetrackSettings();
  const readout = signal<TrayReadout | null>(null);

  const collected = computed(() => ({
    windows: windows.lastRun(),
    git: git.lastRun(),
    sessions: agentSessions.lastRun(),
    calendar: calendar.lastRun(),
    timer: timers.revision(),
    elapsed: formatTimer({ running: timers.running(), elapsedMs: timers.elapsedMs() }),
    pause: formatPause({ isPaused: pause.isPaused(), pausedForMs: pause.pausedForMs() }),
    targetMs: settings.settings().dayTargetMs,
    /** A rule named a context the day could not, so the total it reports changes with it. */
    rules: settings.settings().attributionRules.length,
  }));

  const read$ = (): Observable<TrayReadout> => {
    const key = localDayKey(new Date());
    const { from, to } = localDayRange(key);
    const current = settings.settings();
    const targetMs = current.dayTargetMs;

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
          config: gitFlowConfigFor(current),
          rules: current.attributionRules,
          sessionize: { repoRoots: git.discovery()?.repos ?? [] },
          fill: { maxFillGapMs: current.gapFillMs },
        });
        const day = reviewDay({
          correlation,
          edits: edits ?? EMPTY_DAY_REVIEW_EDITS,
          check: { targetMs },
        });

        return {
          activity: formatActivity(currentActivity({ events, blocks: correlation.blocks })),
          total: formatTotal({ check: day.check, targetMs }),
          timer: formatTimer({ running: timers.running(), elapsedMs: timers.elapsedMs() }),
          pause: formatPause({ isPaused: pause.isPaused(), pausedForMs: pause.pausedForMs() }),
        };
      }),
    );
  };

  merge(toObservable(collected), timer(0, TRAY_READOUT_INTERVAL_MS))
    .pipe(
      concatMap(() => read$().pipe(catchError(() => EMPTY))),
      distinctUntilChanged(
        (before, after) =>
          before.activity === after.activity &&
          before.total === after.total &&
          before.timer === after.timer &&
          before.pause === after.pause,
      ),
      concatMap((next) => {
        readout.set(next);

        return ports.tray.setReadout$(next).pipe(catchError(() => EMPTY));
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { readout: readout.asReadonly() };
});

export const injectTrayReadout = /* @__PURE__ */ toInjectFn(TRAY_READOUT_DEF);
