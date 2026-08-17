import { SyncedWorklog } from '../model/proposal';
import { TempoDayCoverage, coveredMsOf } from '../tempo/coverage';
import { shiftDayKey } from './day';
import { DayReview } from './model';
import { DayReviewGap, dayReviewGap } from './nudge';

/** Monday, because the week under review is a work week and a Sunday start cuts one in half. */
export const DEFAULT_WEEK_STARTS_ON = 1;

const dayOfWeek = (day: string) => {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);

  return new Date(year, month - 1, date).getDay();
};

/** The first day of the week a day falls in. `weekStartsOn` is 0 for Sunday through 6 for Saturday. */
export const startOfWeekKey = (day: string, weekStartsOn = DEFAULT_WEEK_STARTS_ON) => {
  const since = (((dayOfWeek(day) - weekStartsOn) % 7) + 7) % 7;

  return shiftDayKey(day, -since);
};

/** The seven day keys of the week a day falls in, in order, whatever happened on them. */
export const weekDayKeys = (day: string, weekStartsOn = DEFAULT_WEEK_STARTS_ON) => {
  const start = startOfWeekKey(day, weekStartsOn);

  return Array.from({ length: 7 }, (_, index) => shiftDayKey(start, index));
};

/** Moves a week by whole weeks, over month and year ends. */
export const shiftWeekKey = (day: string, byWeeks: number) => shiftDayKey(day, byWeeks * 7);

/** One day of a week, as the catch-up list reads it. */
export type WeekReviewDay = {
  day: string;
  /** What a sync would write for the day. */
  proposedMs: number;
  /** What Tempo already held for the day, which no sync will write again. */
  coveredMs: number;
  /** Observed time no issue claimed. */
  unattributedMs: number;
  /** What the day still owes, or `null` once nothing is left to do on it. */
  gap: DayReviewGap | null;
  /** Whether the day saw anything at all. An empty Saturday is not a day that is behind. */
  worked: boolean;
};

/** One day's answer to the same two questions the reminder asks: what it proposes, and what it owes. */
export type WeekReviewDayInput = {
  day: string;
  review: DayReview;
  ledger: readonly SyncedWorklog[];
  /** What Tempo already held for the day when the Sync preview last read it. */
  coverage?: TempoDayCoverage | null;
  /** The same attribute values the sync would write, or the hash reads every synced row as changed. */
  attributesByProposalId?: Record<string, Record<string, string | number | boolean>>;
};

export type WeekReview = {
  /** The days in order, oldest first. */
  days: WeekReviewDay[];
  proposedMs: number;
  /** What Tempo already held across the week. */
  coveredMs: number;
  /** The day target times the days that saw work, so an empty weekend is neither short nor over. */
  targetMs: number;
  /** The proposals plus what Tempo already holds, minus target. Positive is over. */
  deltaMs: number;
  /** How many days still owe something. This is the number the week view exists to show. */
  owingDays: number;
};

/**
 * A week as a list of days to catch up on, each answered from the local ledger by `dayReviewGap`.
 *
 * The reminder is only ever about today, so a day that was missed stays missed until somebody looks
 * for it. This is where they look.
 */
export const reviewWeek = (options: {
  days: readonly WeekReviewDayInput[];
  dayTargetMs: number;
  toleranceMs?: number;
}): WeekReview => {
  const days = [...options.days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((entry): WeekReviewDay => {
      const { proposedMs, unattributedMs } = entry.review.check;
      const coveredMs = coveredMsOf(entry.coverage);

      return {
        day: entry.day,
        proposedMs,
        coveredMs,
        unattributedMs,
        gap: dayReviewGap({
          review: entry.review,
          ledger: entry.ledger,
          coverage: entry.coverage,
          attributesByProposalId: entry.attributesByProposalId,
          toleranceMs: options.toleranceMs,
        }),
        worked: proposedMs > 0 || coveredMs > 0 || unattributedMs > 0 || entry.review.rows.length > 0,
      };
    });

  const proposedMs = days.reduce((sum, day) => sum + day.proposedMs, 0);
  const coveredMs = days.reduce((sum, day) => sum + day.coveredMs, 0);
  const targetMs = options.dayTargetMs * days.filter((day) => day.worked).length;

  return {
    days,
    proposedMs,
    coveredMs,
    targetMs,
    deltaMs: proposedMs + coveredMs - targetMs,
    owingDays: days.filter((day) => day.gap).length,
  };
};
