import {
  addDays,
  addYears,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfYear,
} from 'date-fns';

/**
 * Which grid the calendar is showing:
 *
 * - `month` — the **day grid** of one month (the default).
 * - `year` — the **month grid**: the 12 months of one year.
 * - `multiYear` — the **year grid**: one page of {@link CALENDAR_MULTI_YEAR_PAGE_SIZE} years.
 */
export type CalendarView = 'month' | 'year' | 'multiYear';

/** How precise a selection is — which unit a picked value names, and which grid picks it. */
export type CalendarPrecision = 'day' | 'month' | 'year';

/** The view whose cells hold the precision's unit: that grid is where selection happens. */
export const CALENDAR_PRECISION_VIEW: Record<CalendarPrecision, CalendarView> = {
  day: 'month',
  month: 'year',
  year: 'multiYear',
};

/** The unit each view's cells hold — what a cell of that grid compares dates at. */
export const CALENDAR_VIEW_UNIT: Record<CalendarView, CalendarPrecision> = {
  month: 'day',
  year: 'month',
  multiYear: 'year',
};

/** Same-unit comparison per precision. */
export const CALENDAR_UNIT_IS_SAME: Record<CalendarPrecision, (left: Date, right: Date) => boolean> = {
  day: isSameDay,
  month: isSameMonth,
  year: isSameYear,
};

/** Start of the unit `date` falls in — what a selection at that precision writes. */
export const startOfCalendarUnit = (date: Date, precision: CalendarPrecision) => {
  switch (precision) {
    case 'month':
      return startOfMonth(date);
    case 'year':
      return startOfYear(date);
    default:
      return startOfDay(date);
  }
};

/** A closed day-granular date interval — what a coarse cell covers. */
export type CalendarInterval = {
  start: Date;
  end: Date;
};

/** Cells per row in the month and year grids. */
export const CALENDAR_COARSE_COLUMNS = 4;

/** Years on one page of the year grid — six rows of {@link CALENDAR_COARSE_COLUMNS}. */
export const CALENDAR_MULTI_YEAR_PAGE_SIZE = 24;

/** How far out each view sits, so a view change can tell which way it zoomed. */
export const CALENDAR_VIEW_DEPTH: Record<CalendarView, number> = {
  month: 0,
  year: 1,
  multiYear: 2,
};

/**
 * `view` held at or outside the precision's own grid. A month-precision calendar has no day grid to
 * show — its finest cell *is* a month — so anything finer clamps to the grid that selects.
 */
export const clampCalendarView = (view: CalendarView, precision: CalendarPrecision) => {
  const floor = CALENDAR_PRECISION_VIEW[precision];

  return CALENDAR_VIEW_DEPTH[view] < CALENDAR_VIEW_DEPTH[floor] ? floor : view;
};

const toRows = (cells: Date[]): Date[][] => {
  const rows: Date[][] = [];

  for (let index = 0; index < cells.length; index += CALENDAR_COARSE_COLUMNS) {
    rows.push(cells.slice(index, index + CALENDAR_COARSE_COLUMNS));
  }

  return rows;
};

/** The 12 months of `date`'s year, as rows of {@link CALENDAR_COARSE_COLUMNS}. Each is that month's first day. */
export const generateYearGrid = (date: Date): Date[][] =>
  toRows(Array.from({ length: 12 }, (_, month) => new Date(date.getFullYear(), month, 1)));

/** The years of the page starting at `pageStart`, as rows. Each is that year's January 1st. */
export const generateMultiYearGrid = (pageStart: Date): Date[][] =>
  toRows(
    Array.from(
      { length: CALENDAR_MULTI_YEAR_PAGE_SIZE },
      (_, offset) => new Date(pageStart.getFullYear() + offset, 0, 1),
    ),
  );

/**
 * First year of the page `date` falls on. Pages tile the timeline from `anchorYear`, so with a `min` the
 * bound's own year opens a page rather than sitting somewhere in the middle of one.
 */
export const multiYearPageStart = (date: Date, anchorYear: number) => {
  const year = date.getFullYear();
  const size = CALENDAR_MULTI_YEAR_PAGE_SIZE;
  const offset = (((year - anchorYear) % size) + size) % size;

  return new Date(year - offset, 0, 1);
};

/** What a coarse cell needs to know to decide whether it holds anything selectable. */
export type CalendarAvailability = {
  min: Date | null;
  max: Date | null;
  isDateSelectable: (date: Date) => boolean;
};

/**
 * Whether `interval` contains a selectable day — how a coarse cell decides it is disabled: a month is out
 * when no day inside it can be picked, a year when no day in any of its months can. Mirrors the time
 * picker's "disable an hour when no minute inside it works" rule.
 *
 * The bounds clamp the scan before it starts, so with only `min`/`max` in play this settles in its first
 * iteration. A `dateFilter` is the expensive case, since every day it rejects is another call before the
 * cell can be ruled out — up to 366 for a year cell, which is what it costs to answer the question
 * honestly rather than showing a year that turns out to be empty.
 */
export const hasSelectableDayIn = (interval: CalendarInterval, availability: CalendarAvailability) => {
  const { min, max, isDateSelectable } = availability;
  const start = min !== null && isBefore(interval.start, min) ? startOfDay(min) : interval.start;
  const end = max !== null && isAfter(interval.end, max) ? startOfDay(max) : interval.end;

  if (isAfter(start, end)) {
    return false;
  }

  for (let cursor = start; !isAfter(cursor, end); cursor = addDays(cursor, 1)) {
    if (isDateSelectable(cursor)) {
      return true;
    }
  }

  return false;
};

/** The interval one page of the year grid covers, starting at `pageStart`. */
export const multiYearPageInterval = (pageStart: Date): CalendarInterval => ({
  start: startOfYear(pageStart),
  end: addDays(startOfYear(addYears(pageStart, CALENDAR_MULTI_YEAR_PAGE_SIZE)), -1),
});

/** Whether `date` falls on the page starting at `pageStart`. */
export const isInMultiYearPage = (date: Date, pageStart: Date) => {
  const first = pageStart.getFullYear();
  const year = date.getFullYear();

  return year >= first && year < first + CALENDAR_MULTI_YEAR_PAGE_SIZE;
};
