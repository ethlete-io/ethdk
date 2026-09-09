---
'@ethlete/timetrack': patch
---

A call the app was killed in the middle of no longer counts to now. The next run ends it where the
watching stopped, so a killed run cannot claim every hour since.
