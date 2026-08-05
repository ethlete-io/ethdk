import { addDays, endOfDay, endOfMonth, endOfWeek, isSameDay, startOfMonth, startOfWeek } from 'date-fns';
import { Appointment } from '../../scheduler.types';
import { SchedulerWeekStartsOn } from '../scheduler.directive';
import { AppointmentTreeNode, flattenAppointmentTree } from './scheduler-tree';

/** One day cell of a month grid: the appointments it shows, capped, and the rest it hides. */
export type SchedulerMonthDayCell<TExtra = unknown> = {
  date: Date;
  outsideMonth: boolean;
  today: boolean;
  visible: AppointmentTreeNode<TExtra>[];
  overflow: AppointmentTreeNode<TExtra>[];
};

export type SchedulerMonthGridOptions<TExtra> = {
  focusedDate: Date;
  weekStartsOn: SchedulerWeekStartsOn;
  tree: readonly AppointmentTreeNode<TExtra>[];
  maxVisiblePerCell: number;
  today: Date;
};

const appointmentCoversDay = (appointment: Appointment, day: { start: Date; end: Date }) =>
  appointment.start <= day.end && appointment.end >= day.start;

/**
 * Buckets a sub-appointment tree into a month grid: full weeks padded with the leading/trailing
 * days of adjacent months, each day capped to `maxVisiblePerCell` appointments (chain order
 * preserved, depth-first) with the rest counted as overflow for a "+N more" affordance. An
 * appointment appears on every day it spans, not just the day it starts.
 */
export const buildSchedulerMonthGrid = <TExtra>(
  options: SchedulerMonthGridOptions<TExtra>,
): SchedulerMonthDayCell<TExtra>[][] => {
  const { focusedDate, weekStartsOn, tree, maxVisiblePerCell, today } = options;
  const month = startOfMonth(focusedDate);
  const monthEnd = endOfMonth(focusedDate);
  const flattened = flattenAppointmentTree(tree);
  const weeks: SchedulerMonthDayCell<TExtra>[][] = [];

  let cursor = startOfWeek(month, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

  while (cursor <= gridEnd) {
    const week: SchedulerMonthDayCell<TExtra>[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const day = { start: cursor, end: endOfDay(cursor) };
      const matching = flattened.filter((node) => appointmentCoversDay(node.appointment, day));

      week.push({
        date: cursor,
        outsideMonth: cursor < month || cursor > monthEnd,
        today: isSameDay(cursor, today),
        visible: matching.slice(0, maxVisiblePerCell),
        overflow: matching.slice(maxVisiblePerCell),
      });

      cursor = addDays(cursor, 1);
    }

    weeks.push(week);
  }

  return weeks;
};
