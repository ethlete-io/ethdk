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
  /** The agenda view's name, as shown in the view switch. */
  agenda: string;
  /** Fallback heading for the edit surface while the open appointment has no title yet. */
  untitledAppointment: string;
  /** Accessible label for the edit surface's ancestor breadcrumb. */
  ancestors: string;
  /** Heading above the current appointment's children list in the edit surface. */
  subAppointments: string;
  /** Accessible label for the edit surface's action menu trigger. */
  moreActions: string;
  /** The edit surface's save button. */
  save: string;
  /** The edit surface's cancel button. */
  cancel: string;
  /** Built-in "Add sub-appointment" action label. */
  addSubAppointment: string;
  /** Built-in "Delete (with descendants)" action label. */
  deleteWithDescendants: string;
  /** Label for the built-in title edit field. */
  titleField: string;
  /** Label for the built-in start-time edit field. */
  startField: string;
  /** Label for the built-in end-time edit field. */
  endField: string;
  /** Label for the built-in location edit field. */
  locationField: string;
  /** Label for the built-in description edit field. */
  descriptionField: string;
  /** Label for the built-in color edit field. */
  colorField: string;
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
  agenda: 'Agenda',
  untitledAppointment: 'Untitled appointment',
  ancestors: 'Ancestor chain',
  subAppointments: 'Sub-appointments',
  moreActions: 'More actions',
  save: 'Save',
  cancel: 'Cancel',
  addSubAppointment: 'Add sub-appointment',
  deleteWithDescendants: 'Delete (with descendants)',
  titleField: 'Title',
  startField: 'Starts',
  endField: 'Ends',
  locationField: 'Location',
  descriptionField: 'Description',
  colorField: 'Color',
};

const SCHEDULER_LABELS_DEF = /* @__PURE__ */ defineLabels<SchedulerLabels>(
  'SCHEDULER_LABELS',
  DEFAULT_SCHEDULER_LABELS,
);

export const provideSchedulerLabels = /* @__PURE__ */ toProvideFn(SCHEDULER_LABELS_DEF);
export const injectSchedulerLabels = /* @__PURE__ */ toInjectFn(SCHEDULER_LABELS_DEF);
export const SCHEDULER_LABELS = /* @__PURE__ */ toToken(SCHEDULER_LABELS_DEF);
