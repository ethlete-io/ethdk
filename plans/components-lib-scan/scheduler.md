# scheduler scan - open findings

Scan of `libs/components/src/lib/scheduler/` from 2026-09-28. 0 High, 0 Medium open (6 fixed 2026-09-28), 2 Low, 0 Spec. Skipped: `stories/`, `testing/`, spec bodies (grepped for coverage only), the small badge/edit-field wrappers beyond a skim.

## Accessibility and i18n

- Low: The time-grid body is one `role="row"` that holds all 24 x 7 slot `gridcell`s (`scheduler/scheduler-time-grid-view.component.html:96-227`). A screen reader reports one row of 168 cells, so row and column navigation is wrong. Give each hour its own row, or drop the grid roles for the body and keep the roving focus. M
- Low: Date and time patterns are hardcoded, so a locale with a 12-hour clock or a different date order still shows `HH:mm` and `EEEE, d MMMM yyyy` (`scheduler/scheduler.component.ts:132-153`, `scheduler/scheduler-badge-time-range.component.ts:34`, `scheduler/scheduler-time-grid-view.component.ts:129`, `scheduler/scheduler-edit-surface.component.ts:121`). Use locale-aware tokens (`p`, `PPPP`) or a label/format hook. S
