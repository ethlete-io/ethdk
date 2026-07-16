import { addDays, endOfMonth, startOfMonth, startOfWeek } from 'date-fns';

export type CalendarWeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * All days of the weeks covering `month`, as full 7-day rows. Leading/trailing
 * days belong to the adjacent months. Every date is day-granular (midnight).
 */
export const generateMonthGrid = (month: Date, weekStartsOn: CalendarWeekStartsOn): Date[][] => {
  const monthEnd = endOfMonth(month);
  const weeks: Date[][] = [];
  let cursor = startOfWeek(startOfMonth(month), { weekStartsOn });

  while (cursor <= monthEnd) {
    const week: Date[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }

    weeks.push(week);
  }

  return weeks;
};
