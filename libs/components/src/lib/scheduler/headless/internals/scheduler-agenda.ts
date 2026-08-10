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
/**
 * One agenda row's connector guides, outermost first. `trunk` is an ancestor level whose chain
 * continues past this row, `gap` one whose chain has ended (indent, no line); `branch` is the elbow
 * into this row, `last-branch` the elbow of the final child of its parent, which stops at the row's
 * middle instead of carrying on down. A root row has no guides at all.
 */
export type SchedulerAgendaGuide = 'trunk' | 'gap' | 'branch' | 'last-branch';

/**
 * Works out the connector guides for a day's already-flattened nodes. A level continues when a
 * later row sits at that depth before any row climbs above it - which is exactly what says whether
 * a trunk should be drawn through the rows in between.
 */
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
