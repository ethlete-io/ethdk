// codes 4500-4599
// 4502 is retired: it flagged an edit-surface feature directive outside its surface, and the
// surface no longer takes feature directives.
export const SCHEDULER_ERROR_CODES = {
  /** An opt-in scheduler feature (e.g. a badge adornment) was used outside an `<et-scheduler>`. */
  FEATURE_OUTSIDE_SCHEDULER: 4500,
  /** A view layout directive (e.g. `[etSchedulerMonth]`) was placed outside an `[etScheduler]`. */
  VIEW_OUTSIDE_SCHEDULER: 4501,
  /** `[etSchedulerSwipeNavigation]` was placed on an element that is not an `[etScheduler]`. */
  SWIPE_NAVIGATION_OUTSIDE_SCHEDULER: 4503,
  /** `[etSchedulerAppointmentDrag]` was placed on an element that is not an `[etScheduler]`. */
  APPOINTMENT_DRAG_OUTSIDE_SCHEDULER: 4504,
  /** An edit surface was requested, but `provideSchedulerEditSurface()` is not in scope. */
  EDIT_SURFACE_NOT_REGISTERED: 4505,
  /** A `businessHours` entry has a time that is not `HH:mm`, or ends before it starts. */
  INVALID_BUSINESS_HOURS: 4506,
} as const;
