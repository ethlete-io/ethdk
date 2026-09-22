---
'@ethlete/core': minor
---

Add a browser notification API: `injectNotifications()` exposes a reactive `permission` signal,
`request()`, `show(config)` returning a `NotificationRef`, and `closeAll()` - over both the
`Notification` constructor and the service-worker path, SSR-safe.
