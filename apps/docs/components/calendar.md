# Calendar

`et-calendar` is an inline calendar operating purely on `Date` objects - a day grid that drills out to months and years, single or range selection, min/max bounds, a date filter and the full ARIA-grid keyboard model. It is a standalone element (usable outside forms) and the surface the date input's picker overlay hosts. Import `CALENDAR_IMPORTS`.

```ts
import { CALENDAR_IMPORTS } from '@ethlete/components';
```

```html
<et-calendar [(value)]="date" />
```

## Live demo

<StoryEmbed id="components-date-time-calendar--default" height="420px" />

## Options

On `et-calendar` (forwarded from the headless `[etCalendar]` directive):

| Input                               | Type                                         | Default             | Description                                                                            |
| ----------------------------------- | -------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `mode`                              | `'single' \| 'range' \| 'multiple'`          | `'single'`          | Selection model.                                                                       |
| `min` / `max`                       | `Date \| null`                               | `null`              | Selectable window; days outside are disabled and month navigation stops at the bounds. |
| `dateFilter`                        | `((date: Date) => boolean) \| null`          | `null`              | Return `false` to disable a date (e.g. weekends).                                      |
| `startAt`                           | `Date \| null`                               | `null`              | Where an empty calendar opens and which day it focuses first.                          |
| `precision`                         | `'day' \| 'month' \| 'year'`                 | `'day'`             | Which unit a selection names - `'month'` makes this a month picker.                    |
| `monthsShown`                       | `number`                                     | `1`                 | How many consecutive months the day grid shows side by side.                           |
| `startView`                         | `'month' \| 'year' \| 'multiYear'`           | `'month'`           | Which grid the calendar opens on.                                                      |
| `dateClass`                         | `(date, view) => string \| string[] \| null` | `null`              | Extra classes per cell, in every view - markers of your own.                           |
| `rangeSelectionStrategy`            | `CalendarRangeSelectionStrategy \| null`     | `null`              | What a pick means in `range` mode - snap to weeks, fixed spans, your own.              |
| `comparisonStart` / `comparisonEnd` | `Date \| null`                               | `null`              | A second period banded behind the selection, for "vs. previous" comparisons.           |
| `firstDayOfWeek`                    | `0–6`                                        | locale, else `1`    | `0` = Sunday. Defaults to the locale's week start, Monday without one.                 |
| `locale`                            | `Locale \| null` (date-fns)                  | `DATE_LOCALE` token | Weekday/month labels and cell `aria-label`s. Falls back to date-fns' built-in en-US.   |

| Model           | Type                                         | Description                                                   |
| --------------- | -------------------------------------------- | ------------------------------------------------------------- |
| `value`         | `Date \| null`                               | The selection in `single` mode.                               |
| `rangeValue`    | `{ start: Date \| null; end: Date \| null }` | The selection in `range` mode.                                |
| `multipleValue` | `Date[]`                                     | The selection in `multiple` mode, ascending.                  |
| `activeMonth`   | `Date \| null`                               | The displayed month. `null` follows the selection (or today). |

| Output        | Type   | Description                                         |
| ------------- | ------ | --------------------------------------------------- |
| `monthSelect` | `Date` | A month picked in the month grid, at its 1st.       |
| `yearSelect`  | `Date` | A year picked in the year grid, at its January 1st. |

`et-calendar` also takes **`weekNumbers`**, which renders a leading column of week numbers in the day grid. It is presentation, so it lives on the component rather than the headless directive - which exposes the numbers themselves as `calendar.weekNumbers()`, one per row of `weeks()`. They are localized, not always ISO: the row boundaries follow `firstDayOfWeek` and which week counts as the year's first follows the locale's `firstWeekContainsDate`, so the numbering always names the rows actually on screen. The column is a `rowheader` per row (`aria-label` `"Week 31"`) under a named-but-blank `columnheader`, and the three date inputs forward `weekNumbers` to their picker.

<StoryEmbed id="components-date-time-calendar--week-numbers" height="420px" />

The component also takes `previousMonthLabel` / `nextMonthLabel` for the nav buttons' `aria-label`s while the day grid is showing; unset - and in the coarser views, which have their own - they read [`CALENDAR_LABELS`](/components/localization).

Values are day-granular: the calendar writes dates at midnight local time and compares incoming values by day, ignoring any time-of-day. **Local** is the whole story - every comparison and every label is the runtime's own zone, and there is no zoned mode; see [time zones](/components/date-time-inputs#time-zones) for what that means for stored values and how to keep a calendar date from drifting.

`startAt` decides where an **empty** calendar opens - e.g. next month for a booking form - and which day takes the initial roving focus. A selection always wins over it, as does an explicit `activeMonth`; without any of the three, the calendar opens on today. The date inputs forward it as `startAt` too.

<StoryEmbed id="components-date-time-calendar--start-at" height="420px" />

## View drilling

The header label is a button that zooms the grid out: **day grid → month grid → year grid**, and from the year grid back to the day grid, so it is never a dead end. Picking a year drills into that year's months, picking a month into its day grid - neither writes a value. `startView` decides where the calendar opens: `'year'` to have the reader pick a month first, `'multiYear'` a year (a birth date, say).

```html
<!-- opens on the 12-month grid -->
<et-calendar [(value)]="date" startView="year" />
```

<StoryEmbed id="components-date-time-calendar--month-view" height="420px" />

A coarse cell is disabled when **no** day inside it is selectable, so `min`/`max` and `dateFilter` reach the month and year grids as well - a month whose every day the filter rejects cannot be drilled into. The step buttons move by the unit on show (a month, a year, a 24-year page) and stop at the bounds the same way.

<StoryEmbed id="components-date-time-calendar--year-view" height="420px" />

In a date picker's **bottom sheet** the panel reserves the day grid's tallest case (six week rows), so neither paging a month nor drilling a view moves it: a sheet grows upwards, so a height change would slide its top edge under the reader's thumb. The month and year grids centre in that reserved height. The anchored panel on wider screens, and a bare `<et-calendar>`, size themselves to whichever grid is showing.

Selection and today's marker carry over unchanged: a coarse cell reads as selected when it contains the value (or a range end), and as today when it contains today. `monthSelect` / `yearSelect` fire on a coarse pick, for consumers that want to close a picker at month precision.

## Month and year pickers

`precision` says which unit a selection names. At `'month'` the month grid is the finest one the calendar has: picking a cell there writes the value instead of drilling, and the value is the start of the unit - July 2026 is `2026-07-01T00:00`. At `'year'` the year grid does the same job.

```html
<!-- a month picker -->
<et-calendar [(value)]="month" precision="month" />
```

<StoryEmbed id="components-date-time-calendar--month-precision" height="420px" />

Everything else follows the precision rather than the day: `startView` cannot open a grid finer than it, the header zooms back to the selecting grid rather than the day grid, and a range bands, previews and completes at that unit - so `03/2026 – 06/2026` is a four-cell band in the month grid, and picking the start month twice is a one-month range.

<StoryEmbed id="components-date-time-calendar--month-range" height="420px" />

`min`/`max`/`dateFilter` keep their day-level meaning: a month cell is selectable when _some_ day inside it is, which is the same rule that disables coarse cells while drilling. The date inputs take `precision` too, and derive their text format from it - see [date & time inputs](/components/date-time-inputs#precision).

## Per-date classes

`dateClass` returns extra classes for one cell - busy days, holidays, an event marker. It runs for every rendered cell in every view, so its second argument says which unit `date` starts (`'month'` → a day, `'year'` → a month, `'multiYear'` → a year):

```ts
protected dateClass: CalendarDateClassFn = (date, view) =>
  view === 'month' && isBooked(date) ? 'app-busy' : null;
```

The returned classes are **your** CSS, which is unlayered and therefore wins over the component's own styles without `!important` (see [cascade layers](/core/theming)). The cell keeps its own classes and `data-*` attributes; a class the hook stops returning is taken back off.

<StoryEmbed id="components-date-time-calendar--date-class" height="420px" />

## Range selection

The first click starts the range, a later-or-equal second click completes it, and an earlier one restarts it. While the end is pending, hovering (or moving keyboard focus) previews the band.

<StoryEmbed id="components-date-time-calendar--range" height="420px" />

## Several months at once

`monthsShown` renders consecutive months side by side - two of them is the classic range picker, where a range that spans the turn of a month is one gesture instead of a pick, a navigation and a second pick.

```html
<et-calendar [(rangeValue)]="range" [monthsShown]="2" mode="range" />
```

<StoryEmbed id="components-date-time-calendar--two-months" height="480px" />

Everything is shared across the span rather than repeated: one keyboard scope with a single roving cell, one selection, and a band that runs on through the seam. The header names the whole span (`July – August 2026`, or both years once it crosses one), each column says which month it is, and stepping moves by **one** month so the window slides rather than paging - which is what makes a range across the seam reachable in the first place.

Two details fall out of showing neighbouring months together. The days that spill in from an adjacent month are left to the month that owns them, since two cells for one date would be two ways to pick it and two claims on the roving focus; the empty slots keep the columns lined up. And the coarser grids stay single - drilling out shows one month grid or one year page whatever this says, centred in the width the span reserves, so nothing resizes.

It needs the room: two months at the default cell size is about 580px. The date inputs deliberately do **not** forward it, because their picker has to fit a phone as a bottom sheet - a responsive count is the consuming app's call, from its own breakpoint.

## Range selection strategies

What a pick means in `range` mode is a strategy, and the calendar's own rule - open on the first pick, close on a later-or-equal one, start over on an earlier one - is just the default. `rangeSelectionStrategy` replaces it:

```ts
import { createWeekRangeStrategy, createFixedLengthRangeStrategy } from '@ethlete/components';

protected weeks = createWeekRangeStrategy({ weekStartsOn: 1 });
protected sevenDays = createFixedLengthRangeStrategy({ days: 7 });
```

| Strategy                                    | A pick means                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| default (unset)                             | Open the range, then close it on a later-or-equal pick.                        |
| `createWeekRangeStrategy({ weekStartsOn })` | Open at the start of that week, close at the end of the second pick's week.    |
| `createFixedLengthRangeStrategy({ days })`  | A complete range of `days` days from wherever it landed - one pick, no second. |

<StoryEmbed id="components-date-time-calendar--week-range" height="420px" />

A strategy is two pure functions of `(date, currentRange)`: `select` returns the range a pick produces (an open `end: null` leaves it half-built), and the optional `preview` returns what to band while the reader is only hovering or has moved keyboard focus there. Leaving `preview` out means the band promises exactly what the pick would do, which is usually right; the week strategy overrides it so hovering bands whole weeks from the start, making the snap visible _before_ it happens rather than surprising after. The result is normalized to the calendar's [`precision`](#month-and-year-pickers), so a strategy can work in days without knowing about coarser calendars. The date range input forwards the input.

<StoryEmbed id="components-date-time-calendar--fixed-length-range" height="420px" />

## Multiple dates

`mode="multiple"` collects unrelated dates in `multipleValue` instead of a single value or a range: each pick adds one, and picking it again takes it back out - which is the only way to unpick, so it has to be the same gesture. The array stays ascending, so a consumer never sorts it and the calendar opens on the earliest date picked.

```html
<et-calendar [(multipleValue)]="dates" mode="multiple" />
```

<StoryEmbed id="components-date-time-calendar--multiple" height="420px" />

Nothing bands or previews here - the dates have no relationship to each other - and the grid carries `aria-multiselectable="true"` so assistive tech announces that more than one cell can be picked. It combines with `precision`: at `'month'` each pick toggles a whole month. The date inputs have no `multiple` equivalent; their value is one wire string, so a set of dates is the calendar's own surface.

## Comparison ranges

`comparisonStart` / `comparisonEnd` band a second period behind the selection - the one a report is measuring against ("vs. the previous 30 days"). It is presentation only: those cells stay as selectable as any other, picking never writes to it, and the two ends are read as an interval whichever way round you pass them.

```html
<et-calendar
  [(rangeValue)]="range"
  [comparisonStart]="previous().start"
  [comparisonEnd]="previous().end"
  mode="range"
/>
```

<StoryEmbed id="components-date-time-calendar--comparison-range" height="420px" />

It is drawn as a bar under the cells rather than a second band behind them, so where the two periods overlap the bar simply runs under the selection's band - which is the case the pattern exists to show. Cells carry `data-comparison-band` (`start` / `middle` / `end` / `single`, the last for a one-day period) next to the selection's own `data-band`, so a custom template can draw it differently. The band is visual: pair it with a legend if the comparison needs naming for assistive tech. The date range input forwards both inputs to its picker.

## Disabled dates

`min`/`max` and `dateFilter` combine; disabled days stay focusable (per the ARIA grid pattern) but cannot be selected.

<StoryEmbed id="components-date-time-calendar--disabled-dates" height="420px" />

## Keyboard

Every view uses the same model in its own unit - arrows move by cell, PageUp/PageDown by the unit above it, Shift for a ten-times bigger jump:

| Key                   | Day grid                        | Month grid           | Year grid               |
| --------------------- | ------------------------------- | -------------------- | ----------------------- |
| Arrow left / right    | ∓1 day                          | ∓1 month             | ∓1 year                 |
| Arrow up / down       | ∓1 week                         | ∓1 row (4 months)    | ∓1 row (4 years)        |
| PageUp / PageDown     | ∓1 month                        | ∓1 year              | ∓1 page (24 years)      |
| Shift+PageUp/PageDown | ∓1 year                         | ∓10 years            | ∓10 pages               |
| Home / End            | Start / end of the focused week | January / December   | First / last year shown |
| Enter / Space         | Select the focused day          | Drill into the month | Drill into the year     |

Moving focus past the edge of the visible unit navigates the calendar along with it. The focused date stays a full date in every view - only the step size changes - so drilling in and back out keeps the day the reader was on.

Stepping (buttons or keyboard) slides the new grid in from the travel direction; drilling fades it. Either way the grid on its way out crossfades under the one arriving - both share a single grid area for the length of the transition - and the header label travels with them. All of it stands down under `prefers-reduced-motion`. For custom transitions the headless directive exposes `navigationDirection` (`'forward' | 'backward' | 'zoomIn' | 'zoomOut' | null`), `visibleUnitKey` (the visible unit's identity, whichever view is showing) and `transitionKey` (that plus the view - what the default component tracks its `@for` by). `visibleMonthKey` still names the month specifically.

## Custom header

`et-calendar`'s header is replaceable on its own, so a consumer keeps the grid and its styling while wording and laying out the chrome themselves. Project an `ng-template etCalendarHeader`; it receives the headless directive, which is everything the default header uses:

```html
<et-calendar [(value)]="date">
  <ng-template etCalendarHeader let-calendar>
    <button [disabled]="!calendar.canGoPrev()" (click)="calendar.previous()">Back</button>
    <h3>{{ calendar.headerLabel() }}</h3>
    <button [disabled]="!calendar.canGoNext()" (click)="calendar.next()">Next</button>
  </ng-template>
</et-calendar>
```

<StoryEmbed id="components-date-time-calendar--custom-header" height="420px" />

`headerLabel()`, `view`, `zoomOut()` / `canZoomOut()`, `previous()` / `next()`, `canGoPrev()` / `canGoNext()` and the models are all on it - see [headless usage](#headless-usage) for the full surface. The component also exposes the same directive as **`headless`** (`<et-calendar #cal>` then `cal.headless`), for chrome that sits _outside_ the calendar. Replacing the header means owning its accessibility too: the default one is a named `aria-live` region, so keep the label announced.

## Headless usage {#headless-usage}

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

With `monthsShown` above one, `calendar.monthPages()` is the whole span - one entry per month, each with its `month`, `label`, `weeks` and `weekNumbers` - and `weeks()` is the first of them.

The coarse grids work the same way: `calendar.monthCells()` and `calendar.yearCells()` are rows of `CalendarCellBase` - every field above except the day grid's `dayOfMonth`/`outsideMonth` - which the same `[etCalendarCell]` accepts. Read `calendar.view()` to pick a grid, `headerLabel()` for the header, and drive it with `zoomOut()`, `previous()`/`next()`, or `view.set(…)`; `activateCell(date)` does whatever the view on show should do with a cell (select the day, or drill in), which is what the cell directive calls on click.

## Accessibility

- The grid follows the ARIA grid pattern: `role="grid"` with `row`/`columnheader`/`gridcell` structure and a roving tabindex - exactly one cell is tabbable.
- Cells carry a full localized date as `aria-label`, `aria-selected`, `aria-current="date"` on today and `aria-disabled` on disabled days (which stay focusable).
- The header label is a `button` (it zooms the grid out) whose text is an `aria-live="polite"` region, so stepping and drilling are both announced; its `aria-label` says where it leads. The grid's own `aria-label` follows the visible unit.
- Coarse cells are `gridcell`s like the days, with the month or year as `aria-label`, `aria-selected` when they contain the value and `aria-disabled` when they hold no selectable day.

## Theming

Selection and range-band colors come from the nearest [color theme](/core/theming) (`--et-theme-color-primary-solid`, `--et-theme-color-on-primary`, ink for the today ring); chrome uses surface tokens. Public design token:

| Token                            | Default | Purpose                         |
| -------------------------------- | ------- | ------------------------------- |
| `--et-calendar-cell-size`        | `40px`  | Width/height of one day cell    |
| `--et-calendar-week-number-size` | `28px`  | Width of the week-number column |

## Error codes

The calendar domain owns the `ET2900`–`ET2999` range - see [error codes](/components/error-codes#calendar-et29xx).
