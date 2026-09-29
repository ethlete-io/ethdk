---
'@ethlete/components': minor
---

Add `createSchedulerRegistry()`, the registration list `<et-scheduler>` and `<et-scheduler-edit-surface>` use for badge adornments, toolbar actions, edit fields and appointment actions. A custom `SCHEDULER_FEATURE_HOST` or `SCHEDULER_EDIT_SURFACE_HOST` can use it instead of re-implementing register, filter by `enabled` and sort by `order`.
