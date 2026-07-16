---
'@ethlete/components': minor
---

Calendar: new `et-calendar` element (import `CALENDAR_IMPORTS`) — an inline month calendar on plain `Date` objects with single and range selection (hover preview, restart semantics), `min`/`max`/`dateFilter`, localized labels and the full ARIA-grid keyboard model. Headless `[etCalendar]` + `[etCalendarGrid]` + `[etCalendarCell]` directives are exported for custom markup. Ships the date foundation alongside: `provideDateFormat` / `provideTimeFormat` / `provideDateLocale` tokens and a new `date-fns` (v4) peer dependency.
