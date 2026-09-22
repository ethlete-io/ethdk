---
'@ethlete/timetrack': minor
---

Read a week of days at once: `reviewWeek()` answers which days still owe something, from the same
local ledger the end-of-day reminder reads. Adds `startOfWeekKey()`, `weekDayKeys()`,
`shiftWeekKey()` and `describeDayReviewGap()`, which words a gap for every surface that reports one.
