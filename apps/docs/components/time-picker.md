# Time picker

`et-time-picker` is an inline column-list time picker operating purely on `Date` objects - one scrollable listbox column per time unit, with the column layout (12/24-hour cycle, optional seconds, AM/PM) derived from a date-fns format string. It is a standalone element (usable outside forms) and the surface the [time input](/components/date-time-inputs#time-input)'s picker overlay hosts. [`mode="range"`](#range-picker) puts a time _range_ on the same columns.

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

Each `TimePickerOption` carries `selected` / `focused` / `disabled` flags the option directive mirrors as `data-*` attributes for styling; the column keeps the focused option centered in its scrollport. In `range` mode it also carries `rangeStart` / `rangeEnd` / `band` (`data-range-start`, `data-range-end`, `data-band`), and `picker.sides()` gives you the two ends - name, formatted value, which is active - to build your own side switch out of.

## Range mode {#range-picker}

`mode="range"` puts a **range** on the same one set of columns, the way `mode="range"` does for the [calendar](/components/calendar). The two ends take turns: a side switch above the columns names them, shows both times, and says which one a pick writes.

```html
<et-time-picker [(rangeValue)]="slot" mode="range" />
```

<StoryEmbed id="components-date-time-time-picker--range" height="440px" />

`rangeValue` is a `{ start: Date | null; end: Date | null }` model, so `[(rangeValue)]` is enough on its own. A control whose value is a _pair_ of wire strings needs to know which half moved, so picks are also reported side-tagged:

```html
<et-time-picker [rangeValue]="slot()" (timeSelect)="commit($event.side, $event.time)" mode="range" />
```

| Input                     | Type                                                 | Default     | Description                                             |
| ------------------------- | ---------------------------------------------------- | ----------- | ------------------------------------------------------- |
| `mode`                    | `'single' \| 'range'`                                | `'single'`  | Whether the columns hold `value` or `rangeValue`.       |
| `rangeValue`              | `{ start: Date \| null; end: Date \| null }` (model) | both `null` | The two selected times.                                 |
| `activeSide`              | `'start' \| 'end'` (model)                           | `'start'`   | The end the columns show, and the one a pick writes.    |
| `timeFilter`              | `(date, side) => boolean`                            | `null`      | Rejects individual times, told which end it is filling. |
| `startLabel` / `endLabel` | `string \| null`                                     | `null` ¹    | The two ends' names on the side switch.                 |
| `timeSelect` (output)     | `{ side, time }`                                     | -           | A part was picked, and which end it filled.             |

¹ `null` falls through to [`TIME_PICKER_LABELS`](/components/localization) (`startTime` / `endTime`: `'Start time'` / `'End time'`).

`format`, `locale`, `minuteStep`/`secondStep` and `min`/`max` mean the same as above and apply to both ends. The side switch always renders a **bare** time, even where the columns derive from a combined date & time format - which is what lets the [date-time range input](/components/date-time-inputs#date-time-range-input) hand the picker its `Pp`. The [time range input](/components/date-time-inputs#time-range-input) is the plain-time control built on this mode.

### Which end a pick fills

The columns edit one end at a time because a column can only show one value. A day is one click, but a time is two to four, so a range cannot be built by "first pick opens, second closes" the way the calendar's is - the side switch is what makes the current end explicit.

It hops **once**, on its own: the first committed start moves the columns to the end, which is the calendar's "first pick opens the range" translated into clicks. After that the switch stays where it is put, so going back to correct a start is never interrupted mid-edit. Keyboard browsing never hops at all - arrows commit as they move, so a hop there would strand you on the other end halfway through the column.

**Ordering is not enforced**, exactly as in the calendar and the range inputs: an end before its start is a [validator's](/components/forms#validation) job. The hook for pushing that rule into the picker instead is `timeFilter`'s side argument - "the end must be after the start" is not expressible as a `min`/`max` bound, because the bound differs per end and moves with the value.

```ts
const endAfterStart = (candidate: Date, side: 'start' | 'end') =>
  side === 'start' || slot().start === null || candidate > slot().start;
```

<StoryEmbed id="components-date-time-time-picker--range-end-after-start" height="440px" />

### The band, and where it can't go

A calendar bands a range because a month grid shows every day at once. Time columns don't: they are independent lists, and only some of them can place both ends at all.

The rule is that **a column bands between the two ends when every coarser unit of both agrees**, and stays plain otherwise:

- 09:00 – 17:30 bands the **hours** column from 9 to 17 (there is no unit above it), and leaves **minutes** plain - minute 30 is not "between" anything while the two ends sit in different hours.
- 09:15 – 09:45 bands the **minutes** from 15 to 45, because both ends share hour 9.
- In a 12-hour cycle the **hours** column is only chronological inside one half-day, so a range crossing noon bands the **AM/PM** column instead and leaves the hours alone.

<StoryEmbed id="components-date-time-time-picker--range-within-one-hour" height="440px" />

Wherever a column can place an end, it draws it - the end that is **not** being edited is outlined rather than filled, so both stay readable while only one of them moves.

## Accessibility

- Each column is a labelled `role="listbox"` (`aria-orientation="vertical"`) whose options carry `aria-selected`; exactly one option per column is tabbable.
- Arrow selection follows focus, so what's announced is always what's selected.
- Unselectable options carry `aria-disabled` rather than the `disabled` attribute: the roving tabindex needs them focusable, so they are reachable and announced, just not pickable.
- Disabled/readonly states belong to the hosting control (e.g. the time input) - the inline picker itself is always interactive.
- In `range` mode the side switch is two toggle buttons carrying `aria-pressed`, each named by its label and its current time ("Start time 09:00"), so which end the columns are editing is announced rather than only drawn.

## Theming

Selection colors come from the nearest [color theme](/core/theming) (`--et-theme-color-primary-solid`, `--et-theme-color-on-primary`); text and hover tints use surface tokens. Public design tokens:

| Token                          | Default | Purpose                              |
| ------------------------------ | ------- | ------------------------------------ |
| `--et-time-picker-column-size` | `240px` | Block size of the scrollable columns |
| `--et-time-picker-option-size` | `36px`  | Block size of one option             |

## Error codes

The time picker's structural checks live in the shared date & time block - see [error codes](/components/error-codes#date-time-inputs-et30xx) (`ET3020`/`ET3021`).
