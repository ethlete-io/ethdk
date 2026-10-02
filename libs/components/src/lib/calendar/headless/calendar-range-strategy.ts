import { addDays, endOfWeek, isBefore, startOfDay, startOfWeek } from 'date-fns';
import { CalendarWeekStartsOn } from './internals/calendar-month';

export type CalendarRange = {
  start: Date | null;
  end: Date | null;
};

/**
 * What a pick means in `range` mode. The calendar's own rule - first pick opens the range, a
 * later-or-equal second closes it, an earlier one starts over - is a strategy like any other; naming
 * one here replaces it.
 *
 * Both callbacks are pure: they get the pick, the range as it stands and the calendar's
 * {@link CalendarRangeSelectionContext}, and return the range that should result.
 */
export type CalendarRangeSelectionStrategy = {
  /** The range this pick produces. Returning an open end (`end: null`) leaves the range being built. */
  // eslint-disable-next-line max-params -- the context argument extends the two-argument strategy contract without breaking it
  select: (date: Date, current: CalendarRange, context: CalendarRangeSelectionContext) => CalendarRange;
  /**
   * The range to band while the reader is only hovering (or has moved keyboard focus) over `date`.
   * Defaults to whatever {@link select} would produce, which is usually what a reader wants to be
   * shown - return `null` to preview nothing.
   */
  // eslint-disable-next-line max-params -- the context argument extends the two-argument strategy contract without breaking it
  preview?: (date: Date, current: CalendarRange, context: CalendarRangeSelectionContext) => CalendarRange | null;
};

/** What the calendar tells a range strategy about itself on every pick and preview. */
export type CalendarRangeSelectionContext = {
  /** The first day of the calendar's rows: its `effectiveFirstDayOfWeek()`. */
  weekStartsOn: CalendarWeekStartsOn;
};

export type CalendarWeekRangeStrategyOptions = {
  /** Which day the snapped weeks start on. Defaults to the first day of the calendar's rows. */
  weekStartsOn?: CalendarWeekStartsOn;
};

/**
 * Snaps to whole weeks, in the same two picks a range takes: the first opens the range at the start of
 * the week it lands in, the second closes it at the end of its own, and an earlier second pick starts
 * over. One week is picking the same week twice.
 */
export const createWeekRangeStrategy = (
  options: CalendarWeekRangeStrategyOptions = {},
): CalendarRangeSelectionStrategy => {
  const weekOptionsOf = (context: CalendarRangeSelectionContext) => ({
    weekStartsOn: options.weekStartsOn ?? context.weekStartsOn,
  });
  // day-granular at both ends, like every other date this component produces - `endOfWeek` would
  // hand back a 23:59:59.999 timestamp
  const weekStartOf = (date: Date, context: CalendarRangeSelectionContext) =>
    startOfWeek(startOfDay(date), weekOptionsOf(context));
  const weekEndOf = (date: Date, context: CalendarRangeSelectionContext) =>
    startOfDay(endOfWeek(startOfDay(date), weekOptionsOf(context)));

  const openStart = (current: CalendarRange, context: CalendarRangeSelectionContext) =>
    current.start !== null && current.end === null ? weekStartOf(current.start, context) : null;

  // eslint-disable-next-line max-params -- the context argument extends the two-argument strategy contract without breaking it
  const select = (date: Date, current: CalendarRange, context: CalendarRangeSelectionContext): CalendarRange => {
    const from = openStart(current, context);
    const week = weekStartOf(date, context);

    if (from === null || isBefore(week, from)) {
      return { start: week, end: null };
    }

    return { start: from, end: weekEndOf(date, context) };
  };

  return {
    select,
    // eslint-disable-next-line max-params -- the context argument extends the two-argument strategy contract without breaking it
    preview: (date, current, context) => {
      const from = openStart(current, context);
      const week = weekStartOf(date, context);

      if (current.end !== null) {
        return null;
      }

      return from === null || isBefore(week, from)
        ? { start: week, end: weekEndOf(date, context) }
        : { start: from, end: weekEndOf(date, context) };
    },
  };
};

export type CalendarFixedLengthRangeStrategyOptions = {
  /** How many days the range covers, the picked day included. */
  days: number;
};

/**
 * Every pick is a complete range of `days` days starting where it landed - a stay of a fixed length,
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
   * Bands the span from the open start to the hovered day. Hovering before the start bands nothing,
   * since picking there starts the range over.
   */
  preview: (date, current) => {
    if (current.start === null || current.end !== null) {
      return null;
    }

    const day = startOfDay(date);
    const start = startOfDay(current.start);

    return isBefore(day, start) ? { start: day, end: null } : { start, end: day };
  },
};
