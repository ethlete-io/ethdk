import { formatDurationMs } from '../model/duration';
import { WorklogProposal } from '../model/proposal';
import { WorkGroup } from './merge';

export type RoundOptions = {
  /** Worklogs are logged in whole multiples of this. */
  incrementMs: number;
};

export const DEFAULT_ROUND_OPTIONS: RoundOptions = {
  incrementMs: 15 * 60_000,
};

/**
 * Rounds a day's durations to whole increments while preserving the day's total: each row keeps its
 * whole increments and the leftover increments go to the longest remainders. Rounding every row on
 * its own is what invents or loses half an hour over a fragmented day.
 *
 * A row that would round away to nothing keeps one increment, taken from the longest row, so no row
 * silently vanishes from the timesheet. When only one row is left to take from, it keeps its own
 * increment instead and the total stands.
 */
export const roundDurations = (options: { durationsMs: number[]; options?: Partial<RoundOptions> }): number[] => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.options };
  const durations = options.durationsMs;
  const observedMs = durations.reduce((sum, ms) => sum + ms, 0);
  const increments = new Map<number, number>();

  durations.forEach((ms, index) => increments.set(index, Math.floor(ms / incrementMs)));

  const bump = (index: number, by: number) => increments.set(index, (increments.get(index) ?? 0) + by);
  const byRemainder = durations
    .map((ms, index) => ({ index, ms, remainder: ms % incrementMs }))
    .sort((a, b) => b.remainder - a.remainder || b.ms - a.ms || a.index - b.index);

  const wholeIncrements = observedMs > 0 ? Math.max(1, Math.round(observedMs / incrementMs)) : 0;
  let left = wholeIncrements - [...increments.values()].reduce((sum, count) => sum + count, 0);

  for (const row of byRemainder) {
    if (left <= 0) break;

    bump(row.index, 1);
    left -= 1;
  }

  for (const row of byRemainder) {
    if (row.ms === 0 || (increments.get(row.index) ?? 0) > 0) continue;

    const donor = [...increments]
      .filter(([index]) => index !== row.index)
      .sort(([aIndex, aCount], [bIndex, bCount]) => bCount - aCount || aIndex - bIndex)[0];

    if (!donor || donor[1] < 2) continue;

    bump(donor[0], -1);
    bump(row.index, 1);
  }

  return durations.map((_, index) => (increments.get(index) ?? 0) * incrementMs);
};

export type DayWarningKind =
  | 'under-target'
  | 'over-target'
  | 'unattributed-time'
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
  | 'edited-row-drift';

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
  /** Observed time nothing could attribute. Never folded into the proposals. */
  unattributedMs: number;
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
  maxRowsPerDay?: number;
  /** Time a meeting and observed activity both claim, from `matchMeetings`. */
  meetingOverlapMs?: number;
  /** Time a timer claimed with no activity observed inside it, from `matchTimerRuns`. */
  timerUnobservedMs?: number;
  /** Idle time joined to the work around it, from `fillGaps`. */
  filledMs?: number;
  /** Time the user had stopped collection for, from `pauseWindows`. */
  pausedMs?: number;
};

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
  const { targetMs, toleranceMs, maxRowsPerDay, meetingOverlapMs, timerUnobservedMs, filledMs, pausedMs } =
    options.options ?? {};
  const unattributed = options.unattributed ?? [];
  const proposedMs = options.proposals.reduce((sum, proposal) => sum + proposal.durationMs, 0);
  const coveredMs = options.options?.coveredMs ?? 0;
  const loggedMs = proposedMs + coveredMs;
  const unattributedMs = unattributed.reduce((sum, group) => sum + group.observedMs, 0);
  const tolerance = toleranceMs ?? DEFAULT_ROUND_OPTIONS.incrementMs;
  const warnings: DayWarning[] = [];

  if (targetMs !== undefined) {
    const delta = loggedMs - targetMs;
    const proposed = `${formatDurationMs(proposedMs)} proposed`;
    const against =
      coveredMs > 0
        ? `${proposed} and ${formatDurationMs(coveredMs)} already in Tempo, against a ${formatDurationMs(targetMs)} target`
        : `${proposed} against a ${formatDurationMs(targetMs)} target`;

    if (delta < -tolerance) warnings.push({ kind: 'under-target', detail: against });
    else if (delta > tolerance) warnings.push({ kind: 'over-target', detail: against });
  }

  if (unattributedMs > 0) {
    warnings.push({
      kind: 'unattributed-time',
      detail: `${formatDurationMs(unattributedMs)} across ${unattributed.length} block(s) matched no issue`,
    });
  }

  const rows = options.proposals.length + unattributed.length;

  if (maxRowsPerDay !== undefined && rows > maxRowsPerDay) {
    warnings.push({ kind: 'too-many-rows', detail: `${rows} rows to review, above the ${maxRowsPerDay} row cap` });
  }

  if (meetingOverlapMs !== undefined && meetingOverlapMs >= tolerance) {
    warnings.push({
      kind: 'meeting-overlap',
      detail: `${formatDurationMs(meetingOverlapMs)} is claimed by a meeting and by observed activity at the same time`,
    });
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
    targetMs,
    deltaMs: targetMs === undefined ? undefined : loggedMs - targetMs,
    warnings,
  };
};
