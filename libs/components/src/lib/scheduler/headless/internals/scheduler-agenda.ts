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

export type SchedulerAgendaGuide = 'trunk' | 'gap' | 'branch' | 'last-branch';

export const buildSchedulerAgendaGuides = <TExtra>(
  nodes: readonly AppointmentTreeNode<TExtra>[],
): SchedulerAgendaGuide[][] =>
  nodes.map((node, index) => {
    const continuesAt = (depth: number) => {
      for (const later of nodes.slice(index + 1)) {
        if (later.depth < depth) return false;
        if (later.depth === depth) return true;
      }

      return false;
    };

    return Array.from({ length: node.depth }, (_, level): SchedulerAgendaGuide => {
      const isOwnLevel = level === node.depth - 1;

      if (!isOwnLevel) return continuesAt(level + 1) ? 'trunk' : 'gap';

      return continuesAt(node.depth) ? 'branch' : 'last-branch';
    });
  });

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
