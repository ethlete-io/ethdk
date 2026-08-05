// codes 4500-4599
export const SCHEDULER_ERROR_CODES = {
  /** An opt-in scheduler feature (e.g. a badge adornment) was used outside an `<et-scheduler>`. */
  FEATURE_OUTSIDE_SCHEDULER: 4500,
  /** A view layout directive (e.g. `[etSchedulerMonth]`) was placed outside an `[etScheduler]`. */
  VIEW_OUTSIDE_SCHEDULER: 4501,
} as const;
