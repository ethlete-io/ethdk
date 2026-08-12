import { WorklogProposal } from '../model/proposal';
import { WorkGroup } from './merge';

export type RoundOptions = {
  /** Worklogs are logged in whole multiples of this. */
  incrementMs: number;
};

export const DEFAULT_ROUND_OPTIONS: RoundOptions = {
  incrementMs: 15 * 60_000,
};

const formatMs = (ms: number) => {
  const minutes = Math.round(ms / 60_000);
  const hours = Math.floor(minutes / 60);

  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
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
  'under-target' | 'over-target' | 'unattributed-time' | 'too-many-rows' | 'zero-duration' | 'meeting-overlap';

export type DayWarning = {
  kind: DayWarningKind;
  detail: string;
};

export type DayCheck = {
  /** Sum of the rounded proposals — what a sync would write. */
  proposedMs: number;
  /** Observed time nothing could attribute. Never folded into the proposals. */
  unattributedMs: number;
  targetMs?: number;
  /** Proposed minus target. Positive is over. */
  deltaMs?: number;
  warnings: DayWarning[];
};

export type CheckDayOptions = {
  targetMs?: number;
  /** A day this close to the target is not worth a warning. Defaults to one rounding increment. */
  toleranceMs?: number;
  maxRowsPerDay?: number;
  /** Time a meeting and observed activity both claim, from `matchMeetings`. */
  meetingOverlapMs?: number;
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
  const { targetMs, toleranceMs, maxRowsPerDay, meetingOverlapMs } = options.options ?? {};
  const unattributed = options.unattributed ?? [];
  const proposedMs = options.proposals.reduce((sum, proposal) => sum + proposal.durationMs, 0);
  const unattributedMs = unattributed.reduce((sum, group) => sum + group.observedMs, 0);
  const tolerance = toleranceMs ?? DEFAULT_ROUND_OPTIONS.incrementMs;
  const warnings: DayWarning[] = [];

  if (targetMs !== undefined) {
    const delta = proposedMs - targetMs;
    const against = `${formatMs(proposedMs)} proposed against a ${formatMs(targetMs)} target`;

    if (delta < -tolerance) warnings.push({ kind: 'under-target', detail: against });
    else if (delta > tolerance) warnings.push({ kind: 'over-target', detail: against });
  }

  if (unattributedMs > 0) {
    warnings.push({
      kind: 'unattributed-time',
      detail: `${formatMs(unattributedMs)} across ${unattributed.length} block(s) matched no issue`,
    });
  }

  const rows = options.proposals.length + unattributed.length;

  if (maxRowsPerDay !== undefined && rows > maxRowsPerDay) {
    warnings.push({ kind: 'too-many-rows', detail: `${rows} rows to review, above the ${maxRowsPerDay} row cap` });
  }

  if (meetingOverlapMs !== undefined && meetingOverlapMs >= tolerance) {
    warnings.push({
      kind: 'meeting-overlap',
      detail: `${formatMs(meetingOverlapMs)} is claimed by a meeting and by observed activity at the same time`,
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
    unattributedMs,
    targetMs,
    deltaMs: targetMs === undefined ? undefined : proposedMs - targetMs,
    warnings,
  };
};
