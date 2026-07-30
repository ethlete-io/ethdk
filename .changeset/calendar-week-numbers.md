---
'@ethlete/components': minor
---

Calendar: `weekNumbers` renders a week-number column.

`<et-calendar weekNumbers>` puts a leading column of week numbers on the day grid, and the date,
date-range and date-time inputs forward it to their picker. The numbers are **localized rather than
always ISO**: the rows start on `firstDayOfWeek` and which week counts as the year's first comes from
the locale's `firstWeekContainsDate`, so the numbering names the rows actually on screen instead of a
different week grid. The headless tier exposes them as `calendar.weekNumbers()` — one per row of
`weeks()`, by the same index — so a custom template can render them anywhere.

Each number is its row's `rowheader`, labelled `"Week 31"` for assistive tech and sitting under a
named-but-visually-blank `columnheader`; the roving tabindex stays on the days. New
`--et-calendar-week-number-size` token (`28px`) sizes the column, and the coarse grids widen with it
so drilling still cannot change the calendar's width. New `CALENDAR_LABELS.week` string.
