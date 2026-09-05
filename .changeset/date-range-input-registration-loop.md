---
'@ethlete/components': patch
---

The date, time and date-time range inputs no longer spin forever in development: registering a
side's field read the same signal it writes, re-running the registration effect without end.
