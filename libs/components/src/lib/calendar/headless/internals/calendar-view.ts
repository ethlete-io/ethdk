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
 * - `month` - the **day grid** of one month (the default).
 * - `year` - the **month grid**: the 12 months of one year.
 * - `multiYear` - the **year grid**: one page of {@link CALENDAR_MULTI_YEAR_PAGE_SIZE} years.
 */
export type CalendarView = 'month' | 'year' | 'multiYear';

/** How precise a selection is - which unit a picked value names, and which grid picks it. */
export type CalendarPrecision = 'day' | 'month' | 'year';

export const CALENDAR_PRECISION_VIEW: Record<CalendarPrecision, CalendarView> = {
  day: 'month',
  month: 'year',
  year: 'multiYear',
};

export const CALENDAR_VIEW_UNIT: Record<CalendarView, CalendarPrecision> = {
  month: 'day',
  year: 'month',
  multiYear: 'year',
};

export const CALENDAR_UNIT_IS_SAME: Record<CalendarPrecision, (left: Date, right: Date) => boolean> = {
  day: isSameDay,
  month: isSameMonth,
  year: isSameYear,
};

/** Start of the unit `date` falls in - what a selection at that precision writes. */
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

/** A closed day-granular date interval - what a coarse cell covers. */
export type CalendarInterval = {
  start: Date;
  end: Date;
};

export const CALENDAR_COARSE_COLUMNS = 4;

export const CALENDAR_MULTI_YEAR_PAGE_SIZE = 24;

export const CALENDAR_VIEW_DEPTH: Record<CalendarView, number> = {
  month: 0,
  year: 1,
  multiYear: 2,
};

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

export const generateYearGrid = (date: Date): Date[][] =>
  toRows(Array.from({ length: 12 }, (_, month) => new Date(date.getFullYear(), month, 1)));

export const generateMultiYearGrid = (pageStart: Date): Date[][] =>
  toRows(
    Array.from(
      { length: CALENDAR_MULTI_YEAR_PAGE_SIZE },
      (_, offset) => new Date(pageStart.getFullYear() + offset, 0, 1),
    ),
  );

export const multiYearPageStart = (date: Date, anchorYear: number) => {
  const year = date.getFullYear();
  const size = CALENDAR_MULTI_YEAR_PAGE_SIZE;
  const offset = (((year - anchorYear) % size) + size) % size;

  return new Date(year - offset, 0, 1);
};

export type CalendarAvailability = {
  min: Date | null;
  max: Date | null;
  isDateSelectable: (date: Date) => boolean;
};

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

export const multiYearPageInterval = (pageStart: Date): CalendarInterval => ({
  start: startOfYear(pageStart),
  end: addDays(startOfYear(addYears(pageStart, CALENDAR_MULTI_YEAR_PAGE_SIZE)), -1),
});

export const isInMultiYearPage = (date: Date, pageStart: Date) => {
  const first = pageStart.getFullYear();
  const year = date.getFullYear();

  return year >= first && year < first + CALENDAR_MULTI_YEAR_PAGE_SIZE;
};
