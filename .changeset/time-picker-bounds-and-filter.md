---
'@ethlete/components': minor
---

Give the time picker bounds and a filter, matching the calendar's `min`/`max`/`dateFilter`.
`etTimePicker` / `et-time-picker` take `min`, `max` (only the time of day is read, so one
bound covers every day) and `timeFilter`, which receives the full candidate timestamp so
opening hours can differ per weekday. Availability is per column, not per leaf option: an
hour is only disabled when no minute inside it is selectable, a minute when no second is,
and an AM/PM option when none of its twelve hours works. Unselectable options keep their
place, dimmed and `aria-disabled` (still focusable for the roving tabindex), and the
keyboard model steps over them. Picking a part keeps that part and moves the finer ones to
the first value that works. `et-time-input` and `et-date-time-input` forward the same
bounds as `minTime` / `maxTime` / `timeFilter` (`min`/`max` are reserved by signal forms);
like the date inputs' `minDate`/`maxDate` they shape the picker, not typed entry.
