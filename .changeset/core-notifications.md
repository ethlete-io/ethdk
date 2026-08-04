---
'@ethlete/core': minor
---

Add a browser notification API: `injectNotifications()` exposes a reactive `permission`
signal (kept in sync via the Permissions API, and by re-reading on tab focus on WebKit),
a cold gesture-safe `request()`, `show(config)` returning a `NotificationRef` (`tag`,
a replayed `shown$`, `close()`) and `closeAll()`. `show()` spans both delivery paths - the
`Notification` constructor, falling back to `ServiceWorkerRegistration.showNotification()`
where the constructor is illegal (Android Chrome, installed iOS web apps) - with `actions`,
`image`, `renotify`, `vibrate` and `timestamp` support on the persistent path, `autoClose`,
and an `onClick` that also fires for persistent notifications when the app's service worker
relays the click as `NOTIFICATION_CLICK_MESSAGE_TYPE`. SSR-safe throughout.
