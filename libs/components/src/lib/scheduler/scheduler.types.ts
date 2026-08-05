/** Stable identity of an {@link Appointment}. */
export type AppointmentId = string;

/**
 * One item on the scheduler - a leaf, or a link in a Jira-esque sub-appointment chain via
 * {@link parentId}. `TExtra` is the consumer's own extension point: custom edit-surface fields
 * read and write it, so adding a field never requires widening this type.
 */
export type Appointment<TExtra = unknown> = {
  id: AppointmentId;
  /** The appointment this one nests under, or `null` for a top-level appointment. */
  parentId: AppointmentId | null;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  /** Resolves via the color-theming system - see `theming`. Never a literal color. */
  colorToken?: string;
  /** Shown by the built-in location badge adornment (`etSchedulerBadgeLocation`) when set. */
  location?: string;
  /** Edited by the built-in `etSchedulerEditDescription` edit-surface field. */
  description?: string;
  extra?: TExtra;
};

/** Which of the scheduler's views is on screen. */
export type SchedulerView = 'month' | 'week' | 'day' | 'agenda';

/** The date span a view is currently showing - what appointments get filtered/queried against. */
export type SchedulerVisibleRange = {
  start: Date;
  end: Date;
};
