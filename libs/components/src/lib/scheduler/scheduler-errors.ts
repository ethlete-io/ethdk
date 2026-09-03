// codes 4500-4599
export const SCHEDULER_ERROR_CODES = {
  /** An opt-in scheduler feature (e.g. a badge adornment) was used outside an `<et-scheduler>`. */
  FEATURE_OUTSIDE_SCHEDULER: 4500,
  /** A view layout directive (e.g. `[etSchedulerMonth]`) was placed outside an `[etScheduler]`. */
  VIEW_OUTSIDE_SCHEDULER: 4501,
  /** An edit-surface feature (e.g. an edit field or appointment action) was used outside an `<et-scheduler-edit-surface>`. */
  EDIT_SURFACE_FEATURE_OUTSIDE_SURFACE: 4502,
  /** `[etSchedulerSwipeNavigation]` was placed on an element that is not an `[etScheduler]`. */
  SWIPE_NAVIGATION_OUTSIDE_SCHEDULER: 4503,
  /** `[etSchedulerAppointmentDrag]` was placed on an element that is not an `[etScheduler]`. */
  APPOINTMENT_DRAG_OUTSIDE_SCHEDULER: 4504,
  /** An interaction requires the default edit surface, but it was not registered. */
  EDIT_SURFACE_NOT_REGISTERED: 4505,
} as const;
