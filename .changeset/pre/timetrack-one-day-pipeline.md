---
'@ethlete/timetrack': minor
---

`reviewDay()` now takes `rows: DayRows` and derives its meeting, timer and fill checks itself. The v1
pipeline is gone: `correlateDay()`, `sessionize()` and `DayCorrelation` are removed, so `streamDay()`
builds every day.
