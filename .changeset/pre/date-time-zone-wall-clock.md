---
'@ethlete/components': patch
---

With a `timeZone`, `et-date-time-input` and `et-date-time-range-input` now read an offsetless value, typed text and picked times as the zone's wall clock even in the runtime's skipped hour, and read `minDate`/`maxDate` on the zone's calendar.
