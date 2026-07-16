# Calendar

`et-calendar` is an inline month calendar operating purely on `Date` objects — single or range selection, min/max bounds, a date filter and the full ARIA-grid keyboard model. It is a standalone element (usable outside forms) and the surface the date input's picker overlay hosts. Import `CALENDAR_IMPORTS`.

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

| Input            | Type                                | Default             | Description                                                                            |
| ---------------- | ----------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `mode`           | `'single' \| 'range'`               | `'single'`          | Selection model.                                                                       |
| `min` / `max`    | `Date \| null`                      | `null`              | Selectable window; days outside are disabled and month navigation stops at the bounds. |
| `dateFilter`     | `((date: Date) => boolean) \| null` | `null`              | Return `false` to disable a date (e.g. weekends).                                      |
| `firstDayOfWeek` | `0–6`                               | locale, else `1`    | `0` = Sunday. Defaults to the locale's week start, Monday without one.                 |
| `locale`         | `Locale \| null` (date-fns)         | `DATE_LOCALE` token | Weekday/month labels and cell `aria-label`s. Falls back to date-fns' built-in en-US.   |

| Model         | Type                                         | Description                                                   |
| ------------- | -------------------------------------------- | ------------------------------------------------------------- |
| `value`       | `Date \| null`                               | The selection in `single` mode.                               |
| `rangeValue`  | `{ start: Date \| null; end: Date \| null }` | The selection in `range` mode.                                |
| `activeMonth` | `Date \| null`                               | The displayed month. `null` follows the selection (or today). |

The component also takes `previousMonthLabel` / `nextMonthLabel` (`string`) for the nav buttons' `aria-label`s.

Values are day-granular: the calendar writes dates at midnight local time and compares incoming values by day, ignoring any time-of-day.

## Range selection

The first click starts the range, a later-or-equal second click completes it, and an earlier one restarts it. While the end is pending, hovering (or moving keyboard focus) previews the band.

<StoryEmbed id="components-calendar--range" height="420px" />

## Disabled dates

`min`/`max` and `dateFilter` combine; disabled days stay focusable (per the ARIA grid pattern) but cannot be selected.

<StoryEmbed id="components-calendar--disabled-dates" height="420px" />

## Keyboard

| Key                   | Action                          |
| --------------------- | ------------------------------- |
| Arrow keys            | Move focus by day / week        |
| PageUp / PageDown     | Previous / next month           |
| Shift+PageUp/PageDown | Previous / next year            |
| Home / End            | Start / end of the focused week |
| Enter / Space         | Select the focused day          |

Moving focus past a month boundary navigates the calendar along with it.

## Headless usage

`[etCalendar]` owns all state; `[etCalendarGrid]` (the keyboard + focus scope) and `[etCalendarCell]` (one per day button, fed a `CalendarCell` from `calendar.weeks()`) render however you like:

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

Each `CalendarCell` carries the flags (`selected`, `inRange`, `band`, `outsideMonth`, `today`, `disabled`, `focused`, …) the cell directive mirrors as `data-*` attributes for styling.

## Accessibility

- The grid follows the ARIA grid pattern: `role="grid"` with `row`/`columnheader`/`gridcell` structure and a roving tabindex — exactly one cell is tabbable.
- Cells carry a full localized date as `aria-label`, `aria-selected`, `aria-current="date"` on today and `aria-disabled` on disabled days (which stay focusable).
- The month label is `aria-live="polite"`, so month navigation is announced.

## Theming

Selection and range-band colors come from the nearest [color theme](/core/theming) (`--et-theme-color-primary-solid`, `--et-theme-color-on-primary`, ink for the today ring); chrome uses surface tokens. Public design token:

| Token                     | Default | Purpose                      |
| ------------------------- | ------- | ---------------------------- |
| `--et-calendar-cell-size` | `40px`  | Width/height of one day cell |

## Error codes

The calendar domain owns the `ET2900`–`ET2999` range — see [error codes](/components/error-codes#calendar-et29xx).
