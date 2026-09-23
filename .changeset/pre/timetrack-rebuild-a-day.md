---
'@ethlete/timetrack': patch
---

`streamDay()` rebuilds a day no window observed from the prompts the user typed, with a turn bridging
the minutes between two of them. It reports the rebuilt part as `rebuiltMs`. See ADR 0006.
