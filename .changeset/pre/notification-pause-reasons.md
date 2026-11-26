---
'@ethlete/components': patch
---

Notification: the auto-dismiss timer now holds per reason, so a toast no longer dismisses itself when the pointer leaves while focus is still inside it, or re-arms on a click. `pauseTimer('hover')` / `resumeTimer('hover')`.
