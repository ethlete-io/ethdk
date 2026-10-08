---
'@ethlete/timetrack': patch
---

`listGoogleCalendarEvents$` now drops an all-day entry whose date does not exist, such as `2026-02-30`, instead of rolling it over into the next month.
