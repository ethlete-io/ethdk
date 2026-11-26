---
'@ethlete/timetrack': patch
---

The agent endpoint answers a new `day.events` operation, which returns the evidence one day holds.
The store is encrypted, so this is the only way to read a real day from outside the app.
