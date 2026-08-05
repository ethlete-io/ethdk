import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * Every string the scheduler renders or announces itself. Defaults are English
 * ({@link DEFAULT_SCHEDULER_LABELS}); override them app-wide with {@link provideSchedulerLabels}.
 */
export type SchedulerLabels = {
  /** Accessible label for the control that steps back a period (a month, week or day). */
  previous: string;
  /** Accessible label for the control that steps forward a period. */
  next: string;
  /** Accessible label for the control that jumps back to today. */
  today: string;
  /** The "+N more" overflow affordance in a day cell with more appointments than it can show. */
  moreAppointments: (count: number) => string;
  /** Accessible label for the view-switch control (month/week/day). */
  switchView: string;
  /** The month view's name, as shown in the view switch. */
  month: string;
  /** The week view's name, as shown in the view switch. */
  week: string;
  /** The day view's name, as shown in the view switch. */
  day: string;
};

/** The built-in English labels. */
export const DEFAULT_SCHEDULER_LABELS: SchedulerLabels = {
  previous: 'Previous',
  next: 'Next',
  today: 'Today',
  moreAppointments: (count) => `+${count} more`,
  switchView: 'Switch view',
  month: 'Month',
  week: 'Week',
  day: 'Day',
};

const SCHEDULER_LABELS_DEF = /* @__PURE__ */ defineLabels<SchedulerLabels>(
  'SCHEDULER_LABELS',
  DEFAULT_SCHEDULER_LABELS,
);

export const provideSchedulerLabels = /* @__PURE__ */ toProvideFn(SCHEDULER_LABELS_DEF);
export const injectSchedulerLabels = /* @__PURE__ */ toInjectFn(SCHEDULER_LABELS_DEF);
export const SCHEDULER_LABELS = /* @__PURE__ */ toToken(SCHEDULER_LABELS_DEF);
