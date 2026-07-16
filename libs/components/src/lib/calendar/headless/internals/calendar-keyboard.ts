import { addDays, addMonths, addYears, startOfWeek } from 'date-fns';
import { CalendarWeekStartsOn } from './calendar-month';

export type ResolveCalendarKeyboardDateOptions = {
  shiftKey: boolean;
  focusedDate: Date;
  weekStartsOn: CalendarWeekStartsOn;
};

/**
 * ARIA grid key → target date, relative to the currently focused date.
 * Returns `null` for keys the calendar does not handle (selection is left to
 * the native button activation of the focused cell).
 */
export const resolveCalendarKeyboardDate = (
  key: string,
  { shiftKey, focusedDate, weekStartsOn }: ResolveCalendarKeyboardDateOptions,
): Date | null => {
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
