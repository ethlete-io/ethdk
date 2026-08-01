---
'@ethlete/components': minor
---

Calendar: `monthsShown` renders several months side by side.

The classic two-month range picker, where a range spanning the turn of a month is one gesture instead
of a pick, a navigation and a second pick. Everything is shared across the span rather than repeated:
one keyboard scope with a single roving cell, one selection, and a band that runs on through the seam.
The header names the span (`July – August 2026`, both years once it crosses one), each column says
which month it is, and stepping moves by one month so the window slides - paging by the whole span
would put the seam out of reach again.

The days that spill in from an adjacent month are left to the month that owns them: two cells for one
date would be two ways to pick it and two claims on the roving focus. Empty slots keep the columns
lined up. The coarser grids stay single whatever the count, centred in the width the span reserves, so
neither drilling nor stepping resizes the calendar.

Headless: `monthPages()` is the whole span (each with `month`, `label`, `weeks`, `weekNumbers`),
`weeks()` is the first of them, and `lastVisibleMonth()` closes it. The date inputs do not forward the
input - their picker has to fit a phone as a bottom sheet, so a responsive count belongs to the
consuming app.
