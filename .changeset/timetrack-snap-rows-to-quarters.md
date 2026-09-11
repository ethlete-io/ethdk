---
'@ethlete/timetrack': minor
---

A row's clock times now sit on a 15-minute boundary: the start rounds back, the end to the nearest.
09:38 to 10:01 is written 09:30 to 10:00. Where that would create an overlap, the earlier end rounds
down instead.
