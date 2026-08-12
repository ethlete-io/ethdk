# Time picker

`et-time-picker` is an inline column-list time picker operating purely on `Date` objects - one scrollable listbox column per time unit, with the column layout (12/24-hour cycle, optional seconds, AM/PM) derived from a date-fns format string. It is a standalone element (usable outside forms) and the surface the [time input](/components/date-time-inputs#time-input)'s picker overlay hosts. Import `TIME_PICKER_IMPORTS`.

```ts
import { TIME_PICKER_IMPORTS } from '@ethlete/components';
```

```html
<et-time-picker [(value)]="time" />
```

## Live demo

<StoryEmbed id="components-date-time-time-picker--default" height="360px" />

## Options

On `et-time-picker` (forwarded from the headless `[etTimePicker]` directive):

| Input        | Type                                | Default             | Description                                                                           |
| ------------ | ----------------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `format`     | `string`                            | `TIME_FORMAT` token | date-fns time format the columns derive from (token default: `HH:mm`).                |
| `locale`     | `Locale \| null` (date-fns)         | `DATE_LOCALE` token | Expands localized format tokens (`p`, `pp`) and the AM/PM labels.                     |
| `minuteStep` | `number`                            | `5`                 | Minute column granularity. An off-step selection is kept visible in the column.       |
| `secondStep` | `number`                            | `1`                 | Seconds column granularity (the column only renders when the format carries seconds). |
| `min`        | `Date \| null`                      | `null`              | Earliest selectable time - only the time of day is read, so it applies every day.     |
| `max`        | `Date \| null`                      | `null`              | Latest selectable time, same reading.                                                 |
| `timeFilter` | `((date: Date) => boolean) \| null` | `null`              | Return `false` to make a time unselectable. Receives the full candidate timestamp.    |

| Model   | Type           | Description                                                                   |
| ------- | -------------- | ----------------------------------------------------------------------------- |
| `value` | `Date \| null` | The selected time of day, carried on a `Date`. `null` until a part is picked. |

The component also takes `hoursLabel` / `minutesLabel` / `secondsLabel` / `periodLabel` for the columns' `aria-label`s; unset, they read [`TIME_PICKER_LABELS`](/components/localization).

The format decides the columns, not just their labels: `HH:mm` renders hour + minute columns, `HH:mm:ss` adds seconds, `h:mm a` switches to a 12-hour cycle with an AM/PM column. Localized tokens work too - `p` resolves per locale (12-hour in en-US, 24-hour in de).

While no value is set, the columns anchor their focus and scroll position to "now" (snapped to the steps); the first pick completes that anchor time with the picked part, so a single click on an hour already yields a full time.

## 12-hour cycle

<StoryEmbed id="components-date-time-time-picker--twelve-hour" height="360px" />

## Bounds and filtering

`min` / `max` bound the time of day (their date part is ignored, so one bound covers every day), and `timeFilter` rejects individual times. Options that fall out stay in place, dimmed and `aria-disabled` - they keep their position in the column so the list never reflows, and the keyboard model steps over them.

```html
<et-time-picker [(value)]="slot" [min]="openingTime" [max]="closingTime" [timeFilter]="notDuringLunch" />
```

```ts
const notDuringLunch = (candidate: Date) => candidate.getHours() !== 12;
```

<StoryEmbed id="components-date-time-time-picker--opening-hours" height="360px" />

Availability is computed per column, not per leaf option:

- An **hour** is disabled only when no minute inside it is selectable, a **minute** only when no second inside it is, and an **AM/PM** option only when none of its twelve hours has a selectable time.
- Picking a part keeps that part and moves the **finer** ones to the first value that works: with `min` at 09:40, clicking hour `9` commits `09:40`, not the out-of-bounds `09:00`.
- An **AM/PM** pick chooses a half-day, not an hour, so the hour may move inside it as well - closest to the current clock position first. Picking PM at 10:00 AM under 09:00–17:00 opening hours commits 4 PM rather than doing nothing.
- `timeFilter` receives the whole timestamp (the candidate time of day on the current day), so opening hours can differ per weekday.
- A value set from outside that falls out of bounds is still shown as the selection - bounds gate what a user can pick, they never rewrite the model.

Typed entry in the [time input](/components/date-time-inputs#time-input) and [date-time input](/components/date-time-inputs#date-time-input) is deliberately **not** gated by these bounds - just like the calendar's `minDate`/`maxDate`, they shape the picker, and out-of-range values are a job for a schema validator.

## Keyboard

Each column is a vertical listbox with a roving tabindex; selection follows focus.

| Key                 | Action                                             |
| ------------------- | -------------------------------------------------- |
| ArrowUp / ArrowDown | Previous / next option (wrapping - time is cyclic) |
| Home / End          | First / last option                                |
| Typing digits       | Jump to the matching option (`2`,`3` → 23)         |

Disabled options are skipped by all of these - arrows walk to the next selectable option, Home/End go to the first/last selectable one, and a typed query that only matches disabled options selects nothing.

## Headless usage

`[etTimePicker]` owns all state; `[etTimePickerColumn]` (one per unit, fed a `TimePickerColumn` from `picker.columns()`) and `[etTimePickerOption]` (one per option button) render however you like:

```html
<div #picker="etTimePicker" [(value)]="time" etTimePicker>
  @for (column of picker.columns(); track column.unit) {
  <div [column]="column" etTimePickerColumn>
    @for (option of column.options; track option.value) {
    <button [option]="option" etTimePickerOption>{{ option.label }}</button>
    }
  </div>
  }
</div>
```

Each `TimePickerOption` carries `selected` / `focused` / `disabled` flags the option directive mirrors as `data-*` attributes for styling; the column keeps the focused option centered in its scrollport.

## Accessibility

- Each column is a labelled `role="listbox"` (`aria-orientation="vertical"`) whose options carry `aria-selected`; exactly one option per column is tabbable.
- Arrow selection follows focus, so what's announced is always what's selected.
- Unselectable options carry `aria-disabled` rather than the `disabled` attribute: the roving tabindex needs them focusable, so they are reachable and announced, just not pickable.
- Disabled/readonly states belong to the hosting control (e.g. the time input) - the inline picker itself is always interactive.

## Theming

Selection colors come from the nearest [color theme](/core/theming) (`--et-theme-color-primary-solid`, `--et-theme-color-on-primary`); text and hover tints use surface tokens. Public design tokens:

| Token                          | Default | Purpose                              |
| ------------------------------ | ------- | ------------------------------------ |
| `--et-time-picker-column-size` | `240px` | Block size of the scrollable columns |
| `--et-time-picker-option-size` | `36px`  | Block size of one option             |

## Error codes

The time picker's structural checks live in the shared date & time block - see [error codes](/components/error-codes#date-time-inputs-et30xx) (`ET3020`/`ET3021`).
