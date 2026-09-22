---
'@ethlete/components': minor
---

Forms: add `et-date-time-input` (+ headless `[etDateTimeInput]`), a combined date & time control with a string wire value - one field with a combined display format (strict-then-lenient typed entry, bare dates commit at midnight) and a picker overlay hosting calendar and time picker side by side (Date/Time tabs in the bottom sheet). A first day pick in the picker also commits at midnight - never the current wall-clock time.
