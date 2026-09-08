---
'@ethlete/timetrack': minor
---

`streamDay()` books a turn to its checkout by working directory alone, so an agent that ran while
nobody was at the machine still bills. Each stream reports that time as `unattendedMs`, outside both
presence and engaged time.
