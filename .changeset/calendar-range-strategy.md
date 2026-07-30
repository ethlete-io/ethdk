---
'@ethlete/components': minor
---

Calendar: `rangeSelectionStrategy` decides what a pick means in `range` mode.

The calendar's own rule — open the range, close it on a later-or-equal pick, start over on an earlier
one — is now one strategy among others rather than the only behaviour, and the date range input
forwards the input to its picker. A strategy is two pure functions of `(date, currentRange)`: `select`
returns the range a pick produces, and the optional `preview` returns what to band while the reader is
only hovering. Omitting `preview` means the band promises exactly what the pick would do.

Two are built in:

- **`createWeekRangeStrategy({ weekStartsOn })`** snaps to whole weeks in the same two picks a range
  takes — open at the start of one week, close at the end of another, the same week twice for a single
  week. Its preview bands whole weeks from the first hover, so the snapping shows before it happens
  instead of surprising afterwards.
- **`createFixedLengthRangeStrategy({ days })`** makes every pick a complete span of `days` days from
  where it landed — a fixed stay, a reporting window. There is no half-built state, so the picker
  closes on the first pick.

A strategy works in days and the calendar normalizes its result to `precision`, so the same one serves
a month-precision calendar. `CalendarRange` now lives with the strategies (same public export path).
