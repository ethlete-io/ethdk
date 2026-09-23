import { RuntimeError } from '@ethlete/core';
import { SCHEDULER_ERROR_CODES } from '../../scheduler-errors';
import { SchedulerBusinessHours, SchedulerDayOfWeek } from '../../scheduler.types';

const MINUTES_PER_DAY = 24 * 60;
const TIME_PATTERN = /^(\d{1,2}):([0-5]\d)$/;

/** A stretch of a time-grid day column, in the same percent units a block uses. */
export type SchedulerTimeGridSegment = {
  /** Percent (0-100) of the day the segment starts at. */
  offset: number;
  /** Percent (0-100] of the day the segment covers. */
  span: number;
};

type BusinessRange = { daysOfWeek: readonly SchedulerDayOfWeek[]; start: number; end: number };

const toMinutes = (time: string) => {
  const match = TIME_PATTERN.exec(time);

  if (!match) return null;

  const minutes = Number(match[1]) * 60 + Number(match[2]);

  return minutes <= MINUTES_PER_DAY ? minutes : null;
};

const toBusinessRange = (entry: SchedulerBusinessHours): BusinessRange | null => {
  const start = toMinutes(entry.start);
  const end = toMinutes(entry.end);

  if (start !== null && end !== null && end > start) return { daysOfWeek: entry.daysOfWeek, start, end };

  if (ngDevMode) {
    throw new RuntimeError(
      SCHEDULER_ERROR_CODES.INVALID_BUSINESS_HOURS,
      `businessHours entry "${entry.start}"-"${entry.end}" is invalid: both ends must be HH:mm between 00:00 and 24:00, and end must be later than start.`,
    );
  }

  return null;
};

const toSegment = (start: number, end: number): SchedulerTimeGridSegment => ({
  offset: (start / MINUTES_PER_DAY) * 100,
  span: ((end - start) / MINUTES_PER_DAY) * 100,
});

/** The time outside `businessHours` on each of `days`, one list of segments per day. */
export const buildSchedulerNonBusinessTime = (
  days: readonly Date[],
  businessHours: readonly SchedulerBusinessHours[],
): SchedulerTimeGridSegment[][] => {
  const ranges = businessHours.flatMap((entry) => toBusinessRange(entry) ?? []);

  return days.map((day) => {
    const weekday = day.getDay() as SchedulerDayOfWeek;
    const open = ranges.filter((range) => range.daysOfWeek.includes(weekday)).sort((a, b) => a.start - b.start);
    const closed: SchedulerTimeGridSegment[] = [];

    let cursor = 0;

    for (const range of open) {
      if (range.start > cursor) closed.push(toSegment(cursor, range.start));

      cursor = Math.max(cursor, range.end);
    }

    if (cursor < MINUTES_PER_DAY) closed.push(toSegment(cursor, MINUTES_PER_DAY));

    return closed;
  });
};
