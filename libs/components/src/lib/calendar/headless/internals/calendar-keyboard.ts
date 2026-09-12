import { addDays, addMonths, addYears, setMonth, setYear, startOfWeek } from 'date-fns';
import { CalendarWeekStartsOn } from './calendar-month';
import { CALENDAR_COARSE_COLUMNS, CALENDAR_MULTI_YEAR_PAGE_SIZE, CalendarView } from './calendar-view';

const BIG_JUMP_UNITS = 10;

export type ResolveCalendarKeyboardDateOptions = {
  shiftKey: boolean;
  focusedDate: Date;
  weekStartsOn: CalendarWeekStartsOn;
  view?: CalendarView;
  multiYearPageStart?: Date;
};

const resolveMonthViewDate = (key: string, options: ResolveCalendarKeyboardDateOptions): Date | null => {
  const { shiftKey, focusedDate, weekStartsOn } = options;

  switch (key) {
    case 'ArrowLeft':
      return addDays(focusedDate, -1);
    case 'ArrowRight':
      return addDays(focusedDate, 1);
    case 'ArrowUp':
      return addDays(focusedDate, -7);
    case 'ArrowDown':
      return addDays(focusedDate, 7);
    case 'PageUp':
      return shiftKey ? addYears(focusedDate, -1) : addMonths(focusedDate, -1);
    case 'PageDown':
      return shiftKey ? addYears(focusedDate, 1) : addMonths(focusedDate, 1);
    case 'Home':
      return startOfWeek(focusedDate, { weekStartsOn });
    case 'End':
      return addDays(startOfWeek(focusedDate, { weekStartsOn }), 6);
    default:
      return null;
  }
};

const resolveYearViewDate = (key: string, options: ResolveCalendarKeyboardDateOptions): Date | null => {
  const { shiftKey, focusedDate } = options;

  switch (key) {
    case 'ArrowLeft':
      return addMonths(focusedDate, -1);
    case 'ArrowRight':
      return addMonths(focusedDate, 1);
    case 'ArrowUp':
      return addMonths(focusedDate, -CALENDAR_COARSE_COLUMNS);
    case 'ArrowDown':
      return addMonths(focusedDate, CALENDAR_COARSE_COLUMNS);
    case 'PageUp':
      return addYears(focusedDate, shiftKey ? -BIG_JUMP_UNITS : -1);
    case 'PageDown':
      return addYears(focusedDate, shiftKey ? BIG_JUMP_UNITS : 1);
    case 'Home':
      return setMonth(focusedDate, 0);
    case 'End':
      return setMonth(focusedDate, 11);
    default:
      return null;
  }
};

const resolveMultiYearViewDate = (key: string, options: ResolveCalendarKeyboardDateOptions): Date | null => {
  const { shiftKey, focusedDate, multiYearPageStart } = options;
  const page = CALENDAR_MULTI_YEAR_PAGE_SIZE;

  switch (key) {
    case 'ArrowLeft':
      return addYears(focusedDate, -1);
    case 'ArrowRight':
      return addYears(focusedDate, 1);
    case 'ArrowUp':
      return addYears(focusedDate, -CALENDAR_COARSE_COLUMNS);
    case 'ArrowDown':
      return addYears(focusedDate, CALENDAR_COARSE_COLUMNS);
    case 'PageUp':
      return addYears(focusedDate, shiftKey ? -page * BIG_JUMP_UNITS : -page);
    case 'PageDown':
      return addYears(focusedDate, shiftKey ? page * BIG_JUMP_UNITS : page);
    case 'Home':
      return multiYearPageStart === undefined ? null : setYear(focusedDate, multiYearPageStart.getFullYear());
    case 'End':
      return multiYearPageStart === undefined
        ? null
        : setYear(focusedDate, multiYearPageStart.getFullYear() + page - 1);
    default:
      return null;
  }
};

export const resolveCalendarKeyboardDate = (key: string, options: ResolveCalendarKeyboardDateOptions): Date | null => {
  switch (options.view ?? 'month') {
    case 'year':
      return resolveYearViewDate(key, options);
    case 'multiYear':
      return resolveMultiYearViewDate(key, options);
    default:
      return resolveMonthViewDate(key, options);
  }
};
