---
'@ethlete/timetrack': patch
---

A gap longer than `maxBreakMs` is no longer a break: a machine left on overnight reported the night
itself as time away from the desk, whether or not the screen was locked in it.
