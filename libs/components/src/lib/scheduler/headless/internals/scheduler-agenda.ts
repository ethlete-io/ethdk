import { endOfDay, isSameDay, startOfDay } from 'date-fns';
import { Appointment } from '../../scheduler.types';
import { AppointmentTreeNode, flattenAppointmentTree } from './scheduler-tree';

/** One day of an agenda list: the appointments (in chain order, depth-first) that touch it. */
export type SchedulerAgendaDay<TExtra = unknown> = {
  date: Date;
  today: boolean;
  nodes: AppointmentTreeNode<TExtra>[];
};

export type SchedulerAgendaOptions<TExtra> = {
  days: readonly Date[];
  tree: readonly AppointmentTreeNode<TExtra>[];
  today: Date;
};

const appointmentCoversDay = (appointment: Appointment, day: { start: Date; end: Date }) =>
  appointment.start <= day.end && appointment.end >= day.start;

/**
 * Groups a sub-appointment tree into an agenda list: one entry per day, holding every appointment
 * that touches it in chain order (a parent immediately followed by its children, depth preserved
 * from the full tree) - so indentation still reads as nesting even when a chain's root falls
 * outside the visible days. An appointment appears on every day it spans, same as the month grid.
 */
export const buildSchedulerAgenda = <TExtra>(options: SchedulerAgendaOptions<TExtra>): SchedulerAgendaDay<TExtra>[] => {
  const { days, tree, today } = options;
  const flattened = flattenAppointmentTree(tree);

  return days.map((date) => {
    const day = { start: startOfDay(date), end: endOfDay(date) };

    return {
      date,
      today: isSameDay(date, today),
      nodes: flattened.filter((node) => appointmentCoversDay(node.appointment, day)),
    };
  });
};
