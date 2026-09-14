import { streamKeyLabel, streamKeyRepoPath } from '../model/block';
import { formatDurationMs, formatTimeOfDay } from '../model/duration';
import { WorklogProposal } from '../model/proposal';
import { CALL_LANE_KEY, laneKeyOf } from './lane';
import { WorkGroup } from './merge';

export type RoundOptions = {
  /** Worklogs are logged in whole multiples of this. */
  incrementMs: number;
};

export const DEFAULT_ROUND_OPTIONS: RoundOptions = {
  incrementMs: 15 * 60_000,
};

/**
 * The whole increments a duration books. Any part of an increment books the whole of it, because
 * Tempo accepts nothing smaller and a part-increment row cannot be written at all.
 *
 * This is what a row books, never what it observed: `WorklogProposal.observedMs` keeps the raw time.
 * Booking a day therefore claims more than the day observed, by design.
 */
export const roundDurationUp = (durationMs: number, options?: Partial<RoundOptions>) => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options };

  return Math.ceil(durationMs / incrementMs) * incrementMs;
};

export type DayWarningKind =
  | 'under-target'
  | 'over-target'
  | 'unattributed-time'
  /** Part of the day an agent worked alone, which is the machine's time rather than the user's. */
  | 'unattended-time'
  | 'too-many-rows'
  | 'zero-duration'
  | 'meeting-overlap'
  /** A timer ran while the machine saw almost nothing, which is what a forgotten timer looks like. */
  | 'timer-unobserved'
  /** The day claims idle gaps that `fillGaps` joined to the work around them. */
  | 'filled-time'
  /** Collection was stopped for part of the day, so the day is short by design. */
  | 'paused-time'
  /** Raised by `reviewDay`, not here: new evidence under a row a reviewer had already edited. */
  | 'edited-row-drift'
  /** Raised by `reviewDay`, not here: an edited row whose proposals the engine no longer builds. */
  | 'stale-edit';

/**
 * A call the day also observed work during. It is time the day proposes twice, so the reviewer is told
 * which call it was and when: without both they cannot find the pair of rows on screen.
 */
export type MeetingOverlap = {
  /** What the call reads as: the issue its row was named for, or the call's own label. */
  label: string;
  from: Date;
  overlapMs: number;
};

export type DayWarning = {
  kind: DayWarningKind;
  detail: string;
};

export type DayCheck = {
  /** Sum of the rounded proposals — what a sync would write. */
  proposedMs: number;
  /** Time Tempo already holds for the day and no sync will write again. */
  coveredMs: number;
  /** What the day is logged for in total: the proposals plus what Tempo already holds. */
  loggedMs: number;
  /**
   * Observed time nothing could attribute, and that a person was there for. Never folded into the
   * proposals. Time nobody was there for is `unattendedMs` instead: it is not work waiting for a name,
   * so counting it here would read as a question the reviewer has to answer.
   *
   * Only bookable bands count: a band with no checkout and no call behind it is drawn, and asking the
   * reviewer to name time no worklog could ever hold is asking a question with no answer.
   */
  unattributedMs: number;
  /** Observed time an agent worked alone. Drawn, counted, and never proposed. */
  unattendedMs: number;
  targetMs?: number;
  /** Logged minus target. Positive is over. */
  deltaMs?: number;
  warnings: DayWarning[];
};

export type CheckDayOptions = {
  targetMs?: number;
  /**
   * Time Tempo already holds for the day that this app did not write, from `TempoDayCoverage`.
   *
   * A day logged by hand proposes nothing — every row is reduced to zero by the same foreign time —
   * so without this the target compares against `0m` and reports a finished day as short.
   */
  coveredMs?: number;
  /** A day this close to the target is not worth a warning. Defaults to one rounding increment. */
  toleranceMs?: number;
  /**
   * Whether the day is over. A day still being worked is short of its target by definition, so
   * `under-target` is raised only once the day can no longer grow. `over-target` is raised either way.
   */
  finished?: boolean;
  maxRowsPerDay?: number;
  /** The calls whose minutes observed activity also claims, from `matchCalls`. */
  meetingOverlaps?: readonly MeetingOverlap[];
  /** Time a timer claimed with no activity observed inside it, from `matchTimerRuns`. */
  timerUnobservedMs?: number;
  /** Idle time joined to the work around it, from `fillGaps`. */
  filledMs?: number;
  /** Time the user had stopped collection for, from `pauseWindows`. */
  pausedMs?: number;
};

/**
 * Whether a band is time a worklog could hold: a checkout's work, or a call. Time in an application
 * alone is neither, and it is drawn on the day without being counted — a reviewer asked to name an
 * hour of browsing is asked a question that has no answer.
 *
 * The lane decides it, and not the blocks, so the footer, the warnings and the bands on screen all
 * read the same day. A group that already answered the question itself is taken at its word: a call a
 * rule excluded is drawn in the call lane and is still not time the day is short of.
 */
const isBookable = (group: WorkGroup) => {
  if (group.bookable !== undefined) return group.bookable;

  const lane = group.laneKey ?? laneKeyOf(group.blocks);

  return lane === CALL_LANE_KEY || (!!lane && !!streamKeyRepoPath(lane));
};

/**
 * Which lane each band of unnamed work sits in, longest first, so the reviewer reads where to look
 * rather than how many bands there are. A day runs several lanes at once, so the parts sum past the
 * clock, and naming them is what makes that legible.
 */
const laneDetail = (options: { groups: readonly WorkGroup[]; totalMs: number }) => {
  const byLane = new Map<string, number>();

  for (const group of options.groups) {
    const lane = group.laneKey ?? laneKeyOf(group.blocks);
    const label = !lane ? 'other work' : lane === CALL_LANE_KEY ? 'calls' : streamKeyLabel(lane);

    byLane.set(label, (byLane.get(label) ?? 0) + group.observedMs);
  }

  const lanes = [...byLane].sort(([, left], [, right]) => right - left);
  const [only] = lanes;

  if (lanes.length === 1 && only) return `${formatDurationMs(only[1])} in ${only[0]}`;

  return `${formatDurationMs(options.totalMs)}: ${lanes
    .map(([label, ms]) => `${label} ${formatDurationMs(ms)}`)
    .join(', ')}`;
};

/** Each call the day also observed work during, named and placed on the clock, longest first. */
const callDetail = (overlaps: readonly MeetingOverlap[]) =>
  [...overlaps]
    .sort((left, right) => right.overlapMs - left.overlapMs)
    .map(
      (overlap) =>
        `${formatDurationMs(overlap.overlapMs)} during the ${formatTimeOfDay(overlap.from)} call ${overlap.label}`,
    )
    .join(', ');

/**
 * Compares a proposed day against its target and reports what a reviewer should look at. It never
 * changes a duration: a day under target is a day under target, and filling it silently would be
 * inventing time.
 */
export const checkDay = (options: {
  proposals: WorklogProposal[];
  unattributed?: WorkGroup[];
  options?: CheckDayOptions;
}): DayCheck => {
  const { targetMs, toleranceMs, finished, maxRowsPerDay, meetingOverlaps, timerUnobservedMs, filledMs, pausedMs } =
    options.options ?? {};
  const unattributed = options.unattributed ?? [];
  const bookable = unattributed.filter(isBookable);
  const proposedMs = options.proposals.reduce((sum, proposal) => sum + proposal.durationMs, 0);
  const coveredMs = options.options?.coveredMs ?? 0;
  const loggedMs = proposedMs + coveredMs;
  const waiting = bookable.filter((group) => group.attended !== false);
  const unattributedMs = waiting.reduce((sum, group) => sum + group.observedMs, 0);
  const unattended = bookable.filter((group) => group.attended === false);
  const unattendedMs = unattended.reduce((sum, group) => sum + group.observedMs, 0);
  const tolerance = toleranceMs ?? DEFAULT_ROUND_OPTIONS.incrementMs;
  const warnings: DayWarning[] = [];

  if (targetMs !== undefined) {
    const delta = loggedMs - targetMs;
    const proposed = `${formatDurationMs(proposedMs)} proposed`;
    const against =
      coveredMs > 0
        ? `${proposed} and ${formatDurationMs(coveredMs)} already in Tempo, against a ${formatDurationMs(targetMs)} target`
        : `${proposed} against a ${formatDurationMs(targetMs)} target`;

    if (delta < -tolerance && finished !== false) warnings.push({ kind: 'under-target', detail: against });
    else if (delta > tolerance) warnings.push({ kind: 'over-target', detail: against });
  }

  if (unattributedMs > 0) {
    warnings.push({
      kind: 'unattributed-time',
      detail: laneDetail({ groups: waiting, totalMs: unattributedMs }),
    });
  }

  if (unattendedMs > 0) {
    warnings.push({
      kind: 'unattended-time',
      detail: `${formatDurationMs(unattendedMs)} across ${unattended.length} block(s) ran with nobody at the machine`,
    });
  }

  const rows = options.proposals.length + unattributed.length;

  if (maxRowsPerDay !== undefined && rows > maxRowsPerDay) {
    warnings.push({ kind: 'too-many-rows', detail: `${rows} rows to review, above the ${maxRowsPerDay} row cap` });
  }

  const overlapping = (meetingOverlaps ?? []).filter((overlap) => overlap.overlapMs > 0);
  const meetingOverlapMs = overlapping.reduce((sum, overlap) => sum + overlap.overlapMs, 0);

  if (meetingOverlapMs >= tolerance) {
    warnings.push({ kind: 'meeting-overlap', detail: callDetail(overlapping) });
  }

  if (timerUnobservedMs !== undefined && timerUnobservedMs >= tolerance) {
    warnings.push({
      kind: 'timer-unobserved',
      detail: `${formatDurationMs(timerUnobservedMs)} of timer time has no observed activity behind it`,
    });
  }

  if (filledMs !== undefined && filledMs >= tolerance) {
    warnings.push({
      kind: 'filled-time',
      detail: `${formatDurationMs(filledMs)} of idle time was joined to the work around it`,
    });
  }

  if (pausedMs !== undefined && pausedMs >= tolerance) {
    warnings.push({
      kind: 'paused-time',
      detail: `${formatDurationMs(pausedMs)} was not collected because you paused it`,
    });
  }

  const zeroed = options.proposals.filter((proposal) => proposal.durationMs === 0);

  if (zeroed.length > 0) {
    warnings.push({
      kind: 'zero-duration',
      detail: `${zeroed.length} row(s) rounded to nothing: ${zeroed.map((proposal) => proposal.issueKey).join(', ')}`,
    });
  }

  return {
    proposedMs,
    coveredMs,
    loggedMs,
    unattributedMs,
    unattendedMs,
    targetMs,
    deltaMs: targetMs === undefined ? undefined : loggedMs - targetMs,
    warnings,
  };
};
