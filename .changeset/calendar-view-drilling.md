---
'@ethlete/components': minor
---

Calendar: the header label now zooms the grid out, and `dateClass` marks cells.

- **Three stacked views.** The day grid drills out to a 12-month grid and then a 24-year grid, via
  the header label - which is a button now - and back in by picking a month or a year. From the year
  grid the label returns to the day grid, so it is never a dead end for a reader who opened it by
  accident. `startView` decides where the calendar opens, so a birth-date field can start on years;
  the date, date-range and date-time inputs forward it to their picker.
- A coarse pick **navigates and nothing more** - it never writes a value. `monthSelect` /
  `yearSelect` report it for consumers who want to close a picker at month precision.
- **`min`/`max`/`dateFilter` reach the coarse grids**: a cell is disabled when no day inside it is
  selectable, which is the only honest answer - a month whose every day the filter rejects has
  nothing to drill into. The scan clamps to the bounds first and stops at the first day that passes,
  so bounds alone cost one check per cell; a filter costs one per day it rejects.
- **The keyboard model is the same in every view, in that view's unit**: arrows by cell (a row is
  four cells in the coarse grids), PageUp/PageDown by the unit above, Shift for ten of those,
  Home/End to the bounds of what is shown. The focused date stays a full date throughout, so
  drilling in and back out keeps the day the reader was on.
- **`dateClass`** - `(date, view) => string | string[] | null` - puts classes of your own on any
  cell, in any view: busy days, holidays, markers. Also forwarded by the three date inputs. The
  classes are your CSS, so they are unlayered and win over the component's own styles without
  `!important`; a class the hook stops returning is taken back off.
- New `CALENDAR_LABELS` strings for the step buttons of the coarser views and the three states of
  the header button (`previousYear`, `nextYear`, `previousYearRange`, `nextYearRange`,
  `switchToYearView`, `switchToMultiYearView`, `switchToMonthView`).
- Headless: `view`, `monthCells()`, `yearCells()`, `headerLabel()`, `zoomOut()`, `previous()`/
  `next()` (the unit on show), `activateCell()`, `isMonthDisabled()`/`isYearDisabled()`,
  `visibleYear`, `multiYearPageStart`, `visibleUnitKey` and `transitionKey`. `navigationDirection`
  gained `'zoomIn'`/`'zoomOut'`; cells gained `label` and `classes`, and `[etCalendarCell]` now
  takes a `CalendarCellBase` so the same directive renders all three grids. Drilling fades the new
  grid in rather than sliding it, and both transitions still stand down under
  `prefers-reduced-motion`.
