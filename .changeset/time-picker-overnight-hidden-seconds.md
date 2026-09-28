---
'@ethlete/components': patch
---

`et-time-picker` treats a `min` later than `max` as a window that wraps past midnight, and with seconds hidden it checks bounds and commits picks at second 0 without milliseconds.
