import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  CurrentActivity,
  DayCheck,
  ReviewedRow,
  TimerRun,
  currentActivity,
  currentAttribution,
  formatDurationMs,
} from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, concatMap, distinctUntilChanged, map, merge, timer } from 'rxjs';
import {
  injectAgentSessionCollector,
  injectCalendarCollector,
  injectGitCollector,
  injectGitLabCollector,
  injectIngestCollector,
  injectWindowCollector,
} from '../collectors';
import { TrayReadout, WidgetReadout, injectHostPorts } from '../host';
import { injectCollectionPause } from './collection-pause';
import { formatBlockLabel, formatClockTime } from './day-review/format';
import { injectTimetrackSettings } from './settings/settings';
import { injectTimer } from './timer';
import { readToday$ } from './read-day';

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
  const against = `${formatDurationMs(check.loggedMs)} of a ${formatDurationMs(options.targetMs)} target`;

  return check.unattributedMs > 0 ? `${against}, ${formatDurationMs(check.unattributedMs)} unattributed` : against;
};

/** The timer entry is the one menu item that acts, so it has to read as the action it will perform. */
const formatTimer = (options: { running: TimerRun | null; elapsedMs: number }) =>
  options.running ? `Stop timer — ${formatDurationMs(options.elapsedMs)}` : 'Start timer';

/** The same for the pause entry, and the same rule: the label is the action, not the state. */
const formatPause = (options: { isPaused: boolean; pausedForMs: number }) =>
  options.isPaused ? `Resume collection — paused ${formatDurationMs(options.pausedForMs)}` : 'Pause collection';

/** What the state itself is, for a readout that shows the state and the work as two separate things. */
const labelActivity = (activity: CurrentActivity) => {
  if (activity.state === 'working') return formatBlockLabel(activity.block);
  if (activity.state === 'paused') return 'Nothing is being watched';
  if (activity.state === 'idle') return 'Nobody at the machine';

  return 'Nothing observed today';
};

/**
 * The same day as the tray readout, in the fields a floating readout shows separately.
 *
 * It is computed here rather than in the widget because this is the window that already reconstructs
 * today — a second window doing it again would double every read, and two windows disagreeing about
 * the same minute is worse than one being a minute late.
 */
const widgetReadout = (options: {
  activity: CurrentActivity;
  rows: readonly ReviewedRow[];
  total: string;
  isPaused: boolean;
}): WidgetReadout => {
  const { activity } = options;
  const attributed = currentAttribution({ activity, rows: options.rows });

  return {
    state: activity.state,
    label: labelActivity(activity),
    since: activity.state === 'unknown' ? '' : formatClockTime(activity.since),
    issueKey: attributed?.issueKey ?? null,
    confidence: attributed?.confidence ?? null,
    total: options.total,
    isPaused: options.isPaused,
  };
};

/** Both readouts of one reconstruction. They are published together, so nothing can disagree. */
type Readouts = { tray: TrayReadout; widget: WidgetReadout };

/**
 * Whether two reconstructions say the same thing. Both documents are flat, so the wording is the
 * whole comparison — and the wording is exactly what a change has to reach a surface for.
 */
const isSame = (before: Readouts, after: Readouts) => JSON.stringify(before) === JSON.stringify(after);

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
  const gitlab = injectGitLabCollector();
  const ingest = injectIngestCollector();
  const timers = injectTimer();
  const pause = injectCollectionPause();
  const settings = injectTimetrackSettings();
  const readout = signal<TrayReadout | null>(null);
  const published = signal<WidgetReadout | null>(null);

  const collected = computed(() => ({
    windows: windows.lastRun(),
    git: git.lastRun(),
    sessions: agentSessions.lastRun(),
    calendar: calendar.lastRun(),
    gitlab: gitlab.lastRun(),
    ingest: ingest.lastRun(),
    timer: timers.revision(),
    elapsed: formatTimer({ running: timers.running(), elapsedMs: timers.elapsedMs() }),
    pause: formatPause({ isPaused: pause.isPaused(), pausedForMs: pause.pausedForMs() }),
    targetMs: settings.settings().dayTargetMs,
    /** A rule named a context the day could not, so the total it reports changes with it. */
    rules: settings.settings().attributionRules.length,
  }));

  const read$ = (): Observable<Readouts> => {
    const current = settings.settings();

    return readToday$({ ports, settings: current, repoRoots: git.discovery()?.repos ?? [] }).pipe(
      map(({ events, correlation, review }) => {
        const activity = currentActivity({ events, blocks: correlation.blocks });
        const total = formatTotal({ check: review.check, targetMs: current.dayTargetMs });

        return {
          tray: {
            activity: formatActivity(activity),
            total,
            timer: formatTimer({ running: timers.running(), elapsedMs: timers.elapsedMs() }),
            pause: formatPause({ isPaused: pause.isPaused(), pausedForMs: pause.pausedForMs() }),
          },
          widget: widgetReadout({ activity, rows: review.rows, total, isPaused: pause.isPaused() }),
        };
      }),
    );
  };

  merge(toObservable(collected), timer(0, TRAY_READOUT_INTERVAL_MS))
    .pipe(
      concatMap(() => read$().pipe(catchError(() => EMPTY))),
      distinctUntilChanged(isSame),
      concatMap((next) => {
        readout.set(next.tray);
        published.set(next.widget);

        return merge(ports.tray.setReadout$(next.tray), ports.widget.publish$(next.widget)).pipe(
          catchError(() => EMPTY),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  // A widget opens between two changes, so the last readout has to be repeatable on request. Nothing
  // is stored for it: the one this window last published is what it asks for.
  ports.widget
    .ready$()
    .pipe(
      concatMap(() => {
        const last = published();

        return last ? ports.widget.publish$(last).pipe(catchError(() => EMPTY)) : EMPTY;
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { readout: readout.asReadonly() };
});

export const injectTrayReadout = /* @__PURE__ */ toInjectFn(TRAY_READOUT_DEF);
