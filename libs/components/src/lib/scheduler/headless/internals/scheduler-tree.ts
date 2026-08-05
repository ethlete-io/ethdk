import { Appointment, AppointmentId } from '../../scheduler.types';

/** One node of the tree {@link buildAppointmentTree} produces - an appointment, its nesting depth, and its direct children, arbitrarily deep. */
export type AppointmentTreeNode<TExtra = unknown> = {
  appointment: Appointment<TExtra>;
  depth: number;
  children: AppointmentTreeNode<TExtra>[];
};

/**
 * Builds the sub-appointment tree from a flat list, keyed by {@link Appointment.parentId}. An
 * appointment whose `parentId` names an id that isn't in the list comes back at the top level,
 * rather than being dropped - a chain that lost its root during filtering still renders. Order
 * within a level follows the input list's order, not start time.
 */
export const buildAppointmentTree = <TExtra>(
  appointments: readonly Appointment<TExtra>[],
): AppointmentTreeNode<TExtra>[] => {
  const knownIds = new Set(appointments.map((appointment) => appointment.id));
  const childrenByParent = new Map<AppointmentId | null, Appointment<TExtra>[]>();

  for (const appointment of appointments) {
    const parentId = appointment.parentId !== null && knownIds.has(appointment.parentId) ? appointment.parentId : null;
    const siblings = childrenByParent.get(parentId);

    if (siblings) {
      siblings.push(appointment);
    } else {
      childrenByParent.set(parentId, [appointment]);
    }
  }

  const buildLevel = (parentId: AppointmentId | null, depth: number): AppointmentTreeNode<TExtra>[] =>
    (childrenByParent.get(parentId) ?? []).map((appointment) => ({
      appointment,
      depth,
      children: buildLevel(appointment.id, depth + 1),
    }));

  return buildLevel(null, 0);
};

/** Flattens a tree depth-first, a parent immediately followed by its children - what the agenda view renders. */
export const flattenAppointmentTree = <TExtra>(
  nodes: readonly AppointmentTreeNode<TExtra>[],
): AppointmentTreeNode<TExtra>[] => nodes.flatMap((node) => [node, ...flattenAppointmentTree(node.children)]);

/** Every descendant a node has, at any depth - what the chain-count badge adornment shows. */
export const countDescendants = (node: Pick<AppointmentTreeNode, 'children'>): number =>
  node.children.reduce((count, child) => count + 1 + countDescendants(child), 0);
