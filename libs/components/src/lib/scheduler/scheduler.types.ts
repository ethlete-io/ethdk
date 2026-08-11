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

/** What a drag on an appointment already on the calendar changes - the whole of it, or one end. */
export type SchedulerAppointmentDragMode = 'move' | 'resize-start' | 'resize-end';

/**
 * An appointment being dragged to a new time. Views lay their appointments out from the range on
 * here rather than the appointment's own, which is what previews the drag; it lives only for as
 * long as the pointer is down.
 */
export type SchedulerAppointmentDrag<TExtra = unknown> = {
  /** The appointment as it stood when the drag began - the range on here is the pending one. */
  appointment: Appointment<TExtra>;
  mode: SchedulerAppointmentDragMode;
  start: Date;
  end: Date;
};

/** A completed move or resize - the payload of `appointmentReschedule`. */
export type SchedulerAppointmentReschedule<TExtra = unknown> = {
  /** The appointment at the time it was dragged to. */
  appointment: Appointment<TExtra>;
  /** The same appointment as it was before the drag. */
  previous: Appointment<TExtra>;
};

/**
 * A time range the user is dragging out on a view to create a new appointment. Stays set while the
 * create surface is open so the surface can stay anchored to the range it came from.
 */
export type SchedulerDraftRange = {
  start: Date;
  end: Date;
  /** `dragging` while the pointer is still down, `committed` once it is released. */
  phase: 'dragging' | 'committed';
  /** Set by views that draw in whole days, so the appointment is created as an all-day one. */
  allDay?: boolean;
};
