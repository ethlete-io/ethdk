---
'@ethlete/query': minor
---

A query batch reports `itemsPerSecond()` and `remainingTime()`, so a long bulk edit can show an ETA
next to its progress. Both are `null` until the run has settled enough items to measure.
