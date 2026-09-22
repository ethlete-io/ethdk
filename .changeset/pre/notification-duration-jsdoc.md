---
'@ethlete/components': patch
---

Correct the `NotificationConfig.duration` JSDoc: `0` never auto-dismisses, and only an omitted
`duration` falls back to the manager's `defaultDuration`.
