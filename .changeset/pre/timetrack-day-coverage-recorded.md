---
'@ethlete/timetrack': minor
---

The week view and the end-of-day reminder no longer call a day unfinished when Tempo already holds its
time; a new `TimetrackCoverageStore` port keeps what the Sync preview read, so both still answer
offline.
