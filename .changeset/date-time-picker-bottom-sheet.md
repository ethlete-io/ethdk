---
'@ethlete/components': minor
---

Date & time pickers (date, date range, time) open as a backdropped bottom sheet with drag-to-dismiss and touch-sized cells on viewports below the `md` breakpoint; anchored panels are unchanged from `md` up. Interactive controls (buttons, select trigger, calendar cells, time picker options, picker triggers) now set `touch-action` so taps activate without the double-tap-zoom delay on touch devices.

- Calendar: month navigation slides the new grid in from the travel direction (skipped under `prefers-reduced-motion`); the headless `[etCalendar]` exposes `navigationDirection` and `visibleMonthKey` for custom transitions. In the bottom sheet the calendar reserves the 6-week height so the sheet never resizes.
- Calendar / time picker: keyboard focus is no longer lost when the focused cell/option is re-created mid-interaction (month crossing, an off-step option leaving the list).
