import { ActionClasses, actionClassOf } from '../agent-api/action-classes';
import { AgentApproval, AutoModeHideRequest } from '../agent-api/approval-queue';
import { CollectedEvent, PresenceEvent, WindowFocusEvent } from '../model/event';
import {
  TimeWindow,
  clipWindows,
  mergeWindows,
  subtractWindows,
  windowsMs,
  windowsOverlap,
} from '../model/time-window';
import { CallMatch } from '../rows/calls';
import { callHolderBelongsTo } from '../stream/calls';
import { isRestOfEndedCall } from './end-call';
import { DayReviewEdits, ReviewedRow } from './model';

/** The shortest rest band auto mode suggests hiding. */
export const OFF_TOPIC_MIN_REST_MS = 30 * 60_000;

/** The most of a rest band the call's own application may hold the focus for. */
export const OFF_TOPIC_MAX_CALL_FOCUS_SHARE = 0.05;

/** The least of a rest band the user must spend at the machine in other applications. */
export const OFF_TOPIC_MIN_OTHER_FOCUS_SHARE = 0.6;

const isFocus = (event: CollectedEvent): event is WindowFocusEvent => event.kind === 'window-focus';

const isPresence = (event: CollectedEvent): event is PresenceEvent => event.source === 'idle';

const awayWindows = (events: readonly CollectedEvent[], until: Date): TimeWindow[] => {
  const edges = events.filter(isPresence).sort((left, right) => left.at.getTime() - right.at.getTime());
  const away: TimeWindow[] = [];
  let since: Date | null = null;

  for (const edge of edges) {
    const leaves = edge.kind === 'idle-start' || edge.kind === 'lock' || edge.kind === 'pause-start';

    if (leaves && !since) since = edge.at;
    if (!leaves && since) {
      away.push({ from: since, to: edge.at });
      since = null;
    }
  }

  return since ? [...away, { from: since, to: until }] : away;
};

const focusHeld = (events: readonly CollectedEvent[], until: Date) => {
  const focus = events.filter(isFocus).sort((left, right) => left.at.getTime() - right.at.getTime());

  return focus.map((event, index) => ({ appId: event.appId, from: event.at, to: focus[index + 1]?.at ?? until }));
};

/** How a rest band's minutes were spent at the machine: in the call's own application, or in others. */
export const restFocusOf = (options: {
  row: TimeWindow;
  calls: readonly CallMatch[];
  events: readonly CollectedEvent[];
}) => {
  const { row } = options;
  const appIds = options.calls.map(({ call }) => call.appId);
  const held = focusHeld(options.events, row.to);
  const away = awayWindows(options.events, row.to);
  const present = (windows: TimeWindow[]) =>
    windowsMs(subtractWindows({ windows: clipWindows({ windows, within: [row] }), without: away }));
  const ownsFocus = (appId: string) => appIds.some((callAppId) => callHolderBelongsTo(callAppId, appId));

  return {
    callFocusMs: present(mergeWindows(held.filter((window) => ownsFocus(window.appId)))),
    otherFocusMs: present(mergeWindows(held.filter((window) => !ownsFocus(window.appId)))),
  };
};

const meetingRunsOver = (row: TimeWindow, calls: readonly CallMatch[]) =>
  calls.some((match) => match.candidates.some(({ event }) => windowsOverlap({ from: event.at, to: event.until }, row)));

/**
 * The rest bands of a day's ended calls that read as the call gone off topic, oldest first.
 *
 * A rest band is the band with no name a call ran on into after the user ended its named row. It
 * reads as off topic when it is at least {@link OFF_TOPIC_MIN_REST_MS} long, no calendar meeting runs
 * over it, the call's own application held the focus for at most {@link OFF_TOPIC_MAX_CALL_FOCUS_SHARE}
 * of it, and the user worked in other applications for at least {@link OFF_TOPIC_MIN_OTHER_FOCUS_SHARE}.
 * Time the user was away counts toward neither share.
 */
export const offTopicRests = (options: {
  rows: readonly ReviewedRow[];
  edits: DayReviewEdits;
  calls: readonly CallMatch[];
  events: readonly CollectedEvent[];
}): ReviewedRow[] =>
  options.rows.filter((row) => {
    const spanMs = row.to.getTime() - row.from.getTime();

    if (row.hidden || row.standInId || spanMs < OFF_TOPIC_MIN_REST_MS) return false;
    if (!isRestOfEndedCall(options.edits, row)) return false;

    const calls = options.calls.filter(({ call }) => windowsOverlap(call, row));

    if (!calls.length || meetingRunsOver(row, calls)) return false;

    const { callFocusMs, otherFocusMs } = restFocusOf({ row, calls, events: options.events });

    return (
      callFocusMs <= spanMs * OFF_TOPIC_MAX_CALL_FOCUS_SHARE && otherFocusMs >= spanMs * OFF_TOPIC_MIN_OTHER_FOCUS_SHARE
    );
  });

export const autoModeHideTarget = (day: string, rowId: string) => `${day}|hide:${rowId}`;

/**
 * The rest bands auto mode suggests hiding now: each off-topic rest of today it never asked about.
 * An item of any state holds its band, so a rejected suggestion is never made again.
 */
export const autoModeHideAsks = (options: {
  enabled: boolean;
  day: string;
  today: string;
  classes: ActionClasses;
  rests: readonly ReviewedRow[];
  approvals: readonly Pick<AgentApproval, 'target'>[];
}): ReviewedRow[] => {
  if (!options.enabled || options.day !== options.today) return [];
  if (actionClassOf('autoMode.apply', options.classes) === 'human-only') return [];

  const asked = new Set(options.approvals.map((item) => item.target));

  return options.rests.filter((row) => !asked.has(autoModeHideTarget(options.day, row.id)));
};

export const autoModeHideRequest = (options: { day: string; row: ReviewedRow }): AutoModeHideRequest => ({
  op: 'autoMode.hide',
  day: options.day,
  rowId: options.row.id,
  label: options.row.description,
  fromMs: options.row.from.getTime(),
});
