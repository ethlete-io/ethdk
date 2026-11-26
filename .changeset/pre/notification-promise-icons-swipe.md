---
'@ethlete/components': minor
---

Notification upgrades:

- `manager.promise(work, { loading, success, error })` follows a promise, an observable or an `@ethlete/query` query in one toast.
- `id` in the config replaces a live notification instead of stacking a duplicate.
- Status icons (overridable per notification via `icon`), plus `secondaryAction` for an action pair.
- Swipe/flick a notification away; opt out with `swipeToDismiss: false`.
