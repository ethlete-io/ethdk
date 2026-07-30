import { addDays, endOfWeek, isBefore, startOfDay, startOfWeek } from 'date-fns';
import { CalendarWeekStartsOn } from './internals/calendar-month';

export type CalendarRange = {
  start: Date | null;
  end: Date | null;
};

/**
 * What a pick means in `range` mode. The calendar's own rule — first pick opens the range, a
 * later-or-equal second closes it, an earlier one starts over — is a strategy like any other; naming
 * one here replaces it, which is how a calendar comes to snap to whole weeks, or to select a fixed
 * seven days from wherever it is clicked.
 *
 * Both callbacks are pure: they get the pick and the range as it stands, and return the range that
 * should result. Nothing about the calendar's state is theirs to change.
 */
export type CalendarRangeSelectionStrategy = {
  /** The range this pick produces. Returning an open end (`end: null`) leaves the range being built. */
  select: (date: Date, current: CalendarRange) => CalendarRange;
  /**
   * The range to band while the reader is only hovering (or has moved keyboard focus) over `date`.
   * Defaults to whatever {@link select} would produce, which is usually what a reader wants to be
   * shown — return `null` to preview nothing.
   */
  preview?: (date: Date, current: CalendarRange) => CalendarRange | null;
};

export type CalendarWeekRangeStrategyOptions = {
  /** Which day the snapped weeks start on. Pass the calendar's `effectiveFirstDayOfWeek()`. */
  weekStartsOn: CalendarWeekStartsOn;
};

/**
 * Snaps to whole weeks, in the same two picks a range takes: the first opens the range at the start of
 * the week it lands in, the second closes it at the end of its own, and an earlier second pick starts
 * over. One week is picking the same week twice — which is why the preview bands whole weeks from the
 * first hover, so the snapping is visible before anything is committed rather than a surprise after.
 */
export const createWeekRangeStrategy = (options: CalendarWeekRangeStrategyOptions): CalendarRangeSelectionStrategy => {
  const weekOptions = { weekStartsOn: options.weekStartsOn };
  // day-granular at both ends, like every other date this component produces — `endOfWeek` would
  // hand back a 23:59:59.999 timestamp
  const weekStartOf = (date: Date) => startOfWeek(startOfDay(date), weekOptions);
  const weekEndOf = (date: Date) => startOfDay(endOfWeek(startOfDay(date), weekOptions));

  /** The week bounds a pick resolves against: `null` while no range is open. */
  const openStart = (current: CalendarRange) =>
    current.start !== null && current.end === null ? weekStartOf(current.start) : null;

  const select = (date: Date, current: CalendarRange): CalendarRange => {
    const from = openStart(current);
    const week = weekStartOf(date);

    if (from === null || isBefore(week, from)) {
      return { start: week, end: null };
    }

    return { start: from, end: weekEndOf(date) };
  };

  return {
    select,
    preview: (date, current) => {
      const from = openStart(current);
      const week = weekStartOf(date);

      if (current.end !== null) {
        return null;
      }

      return from === null || isBefore(week, from)
        ? { start: week, end: weekEndOf(date) }
        : { start: from, end: weekEndOf(date) };
    },
  };
};

export type CalendarFixedLengthRangeStrategyOptions = {
  /** How many days the range covers, the picked day included. */
  days: number;
};

/**
 * Every pick is a complete range of `days` days starting where it landed — a stay of a fixed length,
 * a reporting window. There is no half-built state, so the picker closes on the first pick.
 */
export const createFixedLengthRangeStrategy = (
  options: CalendarFixedLengthRangeStrategyOptions,
): CalendarRangeSelectionStrategy => {
  const span = Math.max(1, Math.trunc(options.days));

  const select = (date: Date): CalendarRange => {
    const start = startOfDay(date);

    return { start, end: addDays(start, span - 1) };
  };

  return { select };
};

/** The calendar's built-in rule, as a strategy: open on the first pick, close on a later-or-equal one. */
export const DEFAULT_CALENDAR_RANGE_STRATEGY: CalendarRangeSelectionStrategy = {
  select: (date, current) => {
    const day = startOfDay(date);

    if (current.start === null || current.end !== null || isBefore(day, startOfDay(current.start))) {
      return { start: day, end: null };
    }

    return { start: current.start, end: day };
  },
  /**
   * Bands the span the two ends would cover, in either direction — hovering back past the open start
   * shows the stretch between them even though picking there would start the range over. That is the
   * calendar's long-standing behaviour, so it stays the default; a strategy that would rather preview
   * only what its pick produces can leave `preview` out and get exactly that.
   */
  preview: (date, current) => {
    if (current.start === null || current.end !== null) {
      return null;
    }

    const day = startOfDay(date);
    const start = startOfDay(current.start);

    return isBefore(day, start) ? { start: day, end: start } : { start, end: day };
  },
};
