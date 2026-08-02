---
'@ethlete/components': minor
---

Calendar: `rangeSelectionStrategy` decides what a pick means in `range` mode, forwarded by the date
range input. A strategy is two pure functions of `(date, currentRange)` - `select`, and the optional
`preview` for what to band on hover. `createWeekRangeStrategy({ weekStartsOn })` snaps to whole weeks
and `createFixedLengthRangeStrategy({ days })` makes every pick a complete span.
