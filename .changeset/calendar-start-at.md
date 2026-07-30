---
'@ethlete/components': minor
---

Add `startAt` to the calendar: where an empty calendar opens and which day takes the
initial roving focus (e.g. next month for a booking form). A selection or an explicit
`activeMonth` still wins over it, and without any of the three the calendar opens on
today. `et-date-input`, `et-date-range-input` and `et-date-time-input` forward it to
their picker calendar.
