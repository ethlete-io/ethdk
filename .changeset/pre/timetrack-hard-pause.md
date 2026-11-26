---
'@ethlete/timetrack': minor
---

Correlate a hard pause: `pauseWindows()` reads the stretches collection was stopped for out
of a day's events, and `correlateDay()` takes them as `pauses` so no row is billed for time
nothing watched.
