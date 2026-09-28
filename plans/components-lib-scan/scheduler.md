# scheduler scan - open findings

Scan of `libs/components/src/lib/scheduler/` from 2026-09-28. 0 High, 0 Medium open (6 fixed 2026-09-28), 8 Low, 1 Spec. Skipped: `stories/`, `testing/`, spec bodies (grepped for coverage only), the small badge/edit-field wrappers beyond a skim.

## Day coverage and time zones

- Low: The `today` flag of every day is `new Date()` read inside a `computed`, so it never updates at midnight (`scheduler/headless/scheduler-time-grid.directive.ts:49`, `scheduler-month.directive.ts:40`, `scheduler-agenda.directive.ts:35`). A scheduler left open overnight highlights yesterday while the now line has moved to today's column. Derive `today` from the scheduler clock. S
- Low: `stepBy` uses `addMonths` on the focused date, so the focused day drifts at month ends (`scheduler/headless/scheduler.directive.ts:317`). Jan 31 -> Feb 28 -> Mar 28, and a later switch to the week view opens on the wrong week. Keep the original day of month, or step from `startOfMonth`. S

## Drag, resize and selection

## Edit surface lifecycle

- Low: The add surface offers "Add sub-appointment" and "Delete" for an appointment that the consumer never saved (`scheduler/headless/scheduler-edit-surface.directive.ts:97-123`, `scheduler/scheduler-action-add-sub-appointment.directive.ts:36-42`, `scheduler/scheduler-action-delete.directive.ts:36-43`). Delete emits `appointmentsDelete` with an unknown id, and add-sub drops the unsaved parent and saves a child whose `parentId` points at nothing. Disable both while the current appointment is not in `appointments()`. S

## Accessibility and i18n

- Low: The time-grid body is one `role="row"` that holds all 24 x 7 slot `gridcell`s (`scheduler/scheduler-time-grid-view.component.html:94-223`). A screen reader reports one row of 168 cells, so row and column navigation is wrong. Give each hour its own row, or drop the grid roles for the body and keep the roving focus. M
- Low: Date and time patterns are hardcoded, so a locale with a 12-hour clock or a different date order still shows `HH:mm` and `EEEE, d MMMM yyyy` (`scheduler/scheduler.component.ts:132-149`, `scheduler/scheduler-badge-time-range.component.ts:34`, `scheduler/scheduler-time-grid-view.component.ts:134`, `scheduler/scheduler-edit-surface.component.ts:121`). Use locale-aware tokens (`p`, `PPPP`) or a label/format hook. S

## Cleanup

- Low: Drag and selected shadows use a hardcoded `rgb(0 0 0 / 0.25)` as the primary value (`scheduler/scheduler-appointment-drag-styles.component.css:34`, `scheduler/scheduler-appointment-styles.component.css:44`). Read a shadow or surface token, with the literal as the fallback only. S
- Low: A zero-length appointment closes its overlap cluster at once, so a block that starts at the same time gets its own full-width cluster and draws on top of it (`scheduler/headless/internals/scheduler-time-grid.ts:113`). Compare with `>` when `clusterEnd` equals the cluster start, or give a zero-length entry a minimum end for packing. S
- Low: Week and day are two separate `@case` branches that render the same component, so a switch between them destroys the time grid and loses the scroll position and roving focus (`scheduler/scheduler.component.html:96-101`). Render one `<et-scheduler-time-grid-view>` for both views. S

## Spec gaps

- Spec: No spec covers a click, the overflow menu or keyboard activation after a completed drag, or a click on an appointment that `selectAppointment()` highlighted.
