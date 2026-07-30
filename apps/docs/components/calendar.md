# Calendar

`et-calendar` is an inline calendar operating purely on `Date` objects — a day grid that drills out to months and years, single or range selection, min/max bounds, a date filter and the full ARIA-grid keyboard model. It is a standalone element (usable outside forms) and the surface the date input's picker overlay hosts. Import `CALENDAR_IMPORTS`.

```ts
import { CALENDAR_IMPORTS } from '@ethlete/components';
```

```html
<et-calendar [(value)]="date" />
```

## Live demo

<StoryEmbed id="components-calendar--default" height="420px" />

## Options

On `et-calendar` (forwarded from the headless `[etCalendar]` directive):

| Input            | Type                                         | Default             | Description                                                                            |
| ---------------- | -------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `mode`           | `'single' \| 'range'`                        | `'single'`          | Selection model.                                                                       |
| `min` / `max`    | `Date \| null`                               | `null`              | Selectable window; days outside are disabled and month navigation stops at the bounds. |
| `dateFilter`     | `((date: Date) => boolean) \| null`          | `null`              | Return `false` to disable a date (e.g. weekends).                                      |
| `startAt`        | `Date \| null`                               | `null`              | Where an empty calendar opens and which day it focuses first.                          |
| `precision`      | `'day' \| 'month' \| 'year'`                 | `'day'`             | Which unit a selection names — `'month'` makes this a month picker.                    |
| `startView`      | `'month' \| 'year' \| 'multiYear'`           | `'month'`           | Which grid the calendar opens on.                                                      |
| `dateClass`      | `(date, view) => string \| string[] \| null` | `null`              | Extra classes per cell, in every view — markers of your own.                           |
| `firstDayOfWeek` | `0–6`                                        | locale, else `1`    | `0` = Sunday. Defaults to the locale's week start, Monday without one.                 |
| `locale`         | `Locale \| null` (date-fns)                  | `DATE_LOCALE` token | Weekday/month labels and cell `aria-label`s. Falls back to date-fns' built-in en-US.   |

| Model         | Type                                         | Description                                                   |
| ------------- | -------------------------------------------- | ------------------------------------------------------------- |
| `value`       | `Date \| null`                               | The selection in `single` mode.                               |
| `rangeValue`  | `{ start: Date \| null; end: Date \| null }` | The selection in `range` mode.                                |
| `activeMonth` | `Date \| null`                               | The displayed month. `null` follows the selection (or today). |

| Output        | Type   | Description                                         |
| ------------- | ------ | --------------------------------------------------- |
| `monthSelect` | `Date` | A month picked in the month grid, at its 1st.       |
| `yearSelect`  | `Date` | A year picked in the year grid, at its January 1st. |

The component also takes `previousMonthLabel` / `nextMonthLabel` for the nav buttons' `aria-label`s while the day grid is showing; unset — and in the coarser views, which have their own — they read [`CALENDAR_LABELS`](/components/localization).

Values are day-granular: the calendar writes dates at midnight local time and compares incoming values by day, ignoring any time-of-day.

`startAt` decides where an **empty** calendar opens — e.g. next month for a booking form — and which day takes the initial roving focus. A selection always wins over it, as does an explicit `activeMonth`; without any of the three, the calendar opens on today. The date inputs forward it as `startAt` too.

<StoryEmbed id="components-calendar--start-at" height="420px" />

## View drilling

The header label is a button that zooms the grid out: **day grid → month grid → year grid**, and from the year grid back to the day grid, so it is never a dead end. Picking a year drills into that year's months, picking a month into its day grid — neither writes a value. `startView` decides where the calendar opens: `'year'` to have the reader pick a month first, `'multiYear'` a year (a birth date, say).

```html
<!-- opens on the 12-month grid -->
<et-calendar [(value)]="date" startView="year" />
```

<StoryEmbed id="components-calendar--month-view" height="420px" />

A coarse cell is disabled when **no** day inside it is selectable, so `min`/`max` and `dateFilter` reach the month and year grids as well — a month whose every day the filter rejects cannot be drilled into. The step buttons move by the unit on show (a month, a year, a 24-year page) and stop at the bounds the same way.

<StoryEmbed id="components-calendar--year-view" height="420px" />

Selection and today's marker carry over unchanged: a coarse cell reads as selected when it contains the value (or a range end), and as today when it contains today. `monthSelect` / `yearSelect` fire on a coarse pick, for consumers that want to close a picker at month precision.

## Month and year pickers

`precision` says which unit a selection names. At `'month'` the month grid is the finest one the calendar has: picking a cell there writes the value instead of drilling, and the value is the start of the unit — July 2026 is `2026-07-01T00:00`. At `'year'` the year grid does the same job.

```html
<!-- a month picker -->
<et-calendar [(value)]="month" precision="month" />
```

<StoryEmbed id="components-calendar--month-precision" height="420px" />

Everything else follows the precision rather than the day: `startView` cannot open a grid finer than it, the header zooms back to the selecting grid rather than the day grid, and a range bands, previews and completes at that unit — so `03/2026 – 06/2026` is a four-cell band in the month grid, and picking the start month twice is a one-month range.

<StoryEmbed id="components-calendar--month-range" height="420px" />

`min`/`max`/`dateFilter` keep their day-level meaning: a month cell is selectable when _some_ day inside it is, which is the same rule that disables coarse cells while drilling. The date inputs take `precision` too, and derive their text format from it — see [date & time inputs](/components/date-time-inputs#precision).

## Per-date classes

`dateClass` returns extra classes for one cell — busy days, holidays, an event marker. It runs for every rendered cell in every view, so its second argument says which unit `date` starts (`'month'` → a day, `'year'` → a month, `'multiYear'` → a year):

```ts
protected dateClass: CalendarDateClassFn = (date, view) =>
  view === 'month' && isBooked(date) ? 'app-busy' : null;
```

The returned classes are **your** CSS, which is unlayered and therefore wins over the component's own styles without `!important` (see [cascade layers](/core/theming)). The cell keeps its own classes and `data-*` attributes; a class the hook stops returning is taken back off.

<StoryEmbed id="components-calendar--date-class" height="420px" />

## Range selection

The first click starts the range, a later-or-equal second click completes it, and an earlier one restarts it. While the end is pending, hovering (or moving keyboard focus) previews the band.

<StoryEmbed id="components-calendar--range" height="420px" />

## Disabled dates

`min`/`max` and `dateFilter` combine; disabled days stay focusable (per the ARIA grid pattern) but cannot be selected.

<StoryEmbed id="components-calendar--disabled-dates" height="420px" />

## Keyboard

Every view uses the same model in its own unit — arrows move by cell, PageUp/PageDown by the unit above it, Shift for a ten-times bigger jump:

| Key                   | Day grid                        | Month grid           | Year grid               |
| --------------------- | ------------------------------- | -------------------- | ----------------------- |
| Arrow left / right    | ∓1 day                          | ∓1 month             | ∓1 year                 |
| Arrow up / down       | ∓1 week                         | ∓1 row (4 months)    | ∓1 row (4 years)        |
| PageUp / PageDown     | ∓1 month                        | ∓1 year              | ∓1 page (24 years)      |
| Shift+PageUp/PageDown | ∓1 year                         | ∓10 years            | ∓10 pages               |
| Home / End            | Start / end of the focused week | January / December   | First / last year shown |
| Enter / Space         | Select the focused day          | Drill into the month | Drill into the year     |

Moving focus past the edge of the visible unit navigates the calendar along with it. The focused date stays a full date in every view — only the step size changes — so drilling in and back out keeps the day the reader was on.

Stepping (buttons or keyboard) slides the new grid in from the travel direction; drilling fades it. Both are skipped under `prefers-reduced-motion`. For custom transitions the headless directive exposes `navigationDirection` (`'forward' | 'backward' | 'zoomIn' | 'zoomOut' | null`), `visibleUnitKey` (the visible unit's identity, whichever view is showing) and `transitionKey` (that plus the view — what the default component tracks its `@for` by). `visibleMonthKey` still names the month specifically.

## Headless usage

`[etCalendar]` owns all state; `[etCalendarGrid]` (the keyboard + focus scope) and `[etCalendarCell]` (one per cell button) render however you like:

```html
<div #cal="etCalendar" [(value)]="date" etCalendar>
  <div etCalendarGrid>
    @for (week of cal.weeks(); track $index) {
    <div role="row">
      @for (cell of week; track cell.date.getTime()) {
      <button [cell]="cell" etCalendarCell type="button">{{ cell.dayOfMonth }}</button>
      }
    </div>
    }
  </div>
</div>
```

Each `CalendarCell` carries the flags (`selected`, `inRange`, `band`, `outsideMonth`, `today`, `disabled`, `focused`, …) the cell directive mirrors as `data-*` attributes for styling, plus `label` (the cell's own text) and `classes` (`dateClass`'s).

The coarse grids work the same way: `calendar.monthCells()` and `calendar.yearCells()` are rows of `CalendarCellBase` — every field above except the day grid's `dayOfMonth`/`outsideMonth` — which the same `[etCalendarCell]` accepts. Read `calendar.view()` to pick a grid, `headerLabel()` for the header, and drive it with `zoomOut()`, `previous()`/`next()`, or `view.set(…)`; `activateCell(date)` does whatever the view on show should do with a cell (select the day, or drill in), which is what the cell directive calls on click.

## Accessibility

- The grid follows the ARIA grid pattern: `role="grid"` with `row`/`columnheader`/`gridcell` structure and a roving tabindex — exactly one cell is tabbable.
- Cells carry a full localized date as `aria-label`, `aria-selected`, `aria-current="date"` on today and `aria-disabled` on disabled days (which stay focusable).
- The header label is a `button` (it zooms the grid out) and `aria-live="polite"`, so stepping and drilling are both announced; its `aria-label` says where it leads. The grid's own `aria-label` follows the visible unit.
- Coarse cells are `gridcell`s like the days, with the month or year as `aria-label`, `aria-selected` when they contain the value and `aria-disabled` when they hold no selectable day.

## Theming

Selection and range-band colors come from the nearest [color theme](/core/theming) (`--et-theme-color-primary-solid`, `--et-theme-color-on-primary`, ink for the today ring); chrome uses surface tokens. Public design token:

| Token                     | Default | Purpose                      |
| ------------------------- | ------- | ---------------------------- |
| `--et-calendar-cell-size` | `40px`  | Width/height of one day cell |

## Error codes

The calendar domain owns the `ET2900`–`ET2999` range — see [error codes](/components/error-codes#calendar-et29xx).
