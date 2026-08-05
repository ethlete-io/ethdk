import { inject, InjectionToken } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SCHEDULER_ERROR_CODES } from '../scheduler-errors';
import { Appointment } from '../scheduler.types';
import { AppointmentTreeNode } from './internals/scheduler-tree';

/**
 * What an opt-in scheduler feature can reach on its host `<et-scheduler>`. Features **register**
 * themselves here (the scheduler never queries for them) - modeled on the table's
 * `TableFeatureHost`. This is the read-only surface every feature needs regardless of which one
 * it is; registration points (badge adornments, edit-surface fields, appointment actions, grid
 * overlays) are added here incrementally as the features that need them land.
 */
export type SchedulerFeatureHost = {
  /** The appointments currently in view - already filtered to the visible range. */
  appointments(): readonly Appointment[];
  /** {@link appointments}, arranged into sub-appointment chains - see `buildAppointmentTree`. */
  appointmentTree(): AppointmentTreeNode[];
  /** The currently selected appointment, or `null`. */
  selectedAppointment(): Appointment | null;
  /** The scheduler's host element - a feature is a directive on it, so this is also what it can listen on or measure. */
  readonly element: HTMLElement;
};

export const SCHEDULER_FEATURE_HOST = new InjectionToken<SchedulerFeatureHost>('SCHEDULER_FEATURE_HOST');

/**
 * Inject the host scheduler from inside a feature. Throws a labelled error when the feature was
 * placed outside an `<et-scheduler>`, where it could only ever silently do nothing.
 */
export const injectSchedulerFeatureHost = (feature: string): SchedulerFeatureHost => {
  const host = inject(SCHEDULER_FEATURE_HOST, { optional: true });

  if (!host) {
    throw new RuntimeError(
      SCHEDULER_ERROR_CODES.FEATURE_OUTSIDE_SCHEDULER,
      `[${feature}] must be used inside an <et-scheduler>.`,
    );
  }

  return host;
};
