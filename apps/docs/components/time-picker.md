# Time picker

`et-time-picker` is an inline 24-hour ring time picker operating purely on `Date` objects - one drag on the ring sets the hour and the minute together, snapped to `minuteStep`. It is a standalone element (usable outside forms) and the surface the [time input](/components/date-time-inputs#time-input)'s picker overlay hosts. [`mode="range"`](#range-picker) puts a time _range_ on the same ring, with two handles and an arc between them, also past midnight.

```ts
import { TIME_PICKER_IMPORTS } from '@ethlete/components';
```

```html
<et-time-picker [(value)]="time" />
```

## Live demo

<StoryEmbed id="components-date-time-time-picker--default" height="420px" />

## Options

On `et-time-picker` (forwarded from the headless `[etTimePicker]` directive):

| Input        | Type                                | Default             | Description                                                                                                  |
| ------------ | ----------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `format`     | `string`                            | `TIME_FORMAT` token | date-fns time format of the ring's labels and readout (token default: `HH:mm`).                              |
| `locale`     | `Locale \| null` (date-fns)         | `DATE_LOCALE` token | Expands localized format tokens (`p`, `pp`) and the AM/PM labels.                                            |
| `minuteStep` | `number`                            | `5`                 | Minute granularity of the ring, clamped to a whole number of at least 1.                                     |
| `min`        | `Date \| null`                      | `null`              | Earliest selectable time - only the time of day is read, so it applies every day.                            |
| `max`        | `Date \| null`                      | `null`              | Latest selectable time, same reading.                                                                        |
| `timeFilter` | `((date: Date) => boolean) \| null` | `null`              | Return `false` to make a time unselectable. Receives the full candidate timestamp.                           |
| `day`        | `Date \| null`                      | `null`              | The day the time falls on, from a calendar next to the picker. Set, the ring centre shows it under the time. |
| `disabled`   | `boolean`                           | `false`             | Blocks every press, drag and key, mutes the dial and takes the handles out of the tab order.                 |

| Model   | Type           | Default | Description                                                                |
| ------- | -------------- | ------- | -------------------------------------------------------------------------- |
| `value` | `Date \| null` | `null`  | The selected time of day, carried on a `Date`. `null` until a time is set. |

[`mode`, `rangeValue`, `activeSide`, `rangeDays`, `startLabel`/`endLabel`, and the `timeSelect` and `rangeHandOff` outputs](#range-picker) belong to range mode.

**The ring picks hours and minutes only.** A drag, a press or a key writes a whole time with seconds at 0, on the day the value already has (today while empty). Seconds are typed in the [time input](/components/date-time-inputs#time-input). The keyboard starts an empty ring at "now", snapped to `minuteStep` with seconds at 0, and re-read whenever focus enters the picker.

The format decides the labels, not the granularity: a 24-hour format labels the ring `00 03 06 … 21`; a 12-hour one (`h:mm a`, or a localized `p` in en-US) keeps the 24-hour ring and labels it `12 AM / 3 / 6 / 9 / 12 PM / …`, with a moon under 12 AM and a sun over 12 PM. Localized tokens work too - `p` resolves per locale (12-hour in en-US, 24-hour in de).

The centre of the ring reads the time live. While no value is set there is no visible handle and no arc: the centre shows `--:--` and a short hint (`emptyHint`), and the first press on the track places the handle. The invisible handle stays in the tab order, so the keys set a first time from "now"; a press on an empty end leaves focus where it was, such as in the input field.

## 12-hour cycle

<StoryEmbed id="components-date-time-time-picker--twelve-hour" height="420px" />

## Steps

`minuteStep` sets where a drag lands. A finer step (`1`) makes every minute reachable by drag; a coarser one (`30`) leaves only the half-hours.

<StoryEmbed id="components-date-time-time-picker--fine-steps" height="420px" />

## Bounds and filtering

`min` / `max` bound the time of day (their date part is ignored, so one bound covers every day; a `min` later than `max`, such as 22:00-06:00, is a window that wraps past midnight), and `timeFilter` rejects individual times. The track exists only where a time can be picked, with butt ends; a blocked span is drawn as a dotted line. While a drag is over a blocked span the handle waits at its edge; once the pointer reaches open time again, even past the night outside `min` / `max`, the handle jumps there - but never past the other end of a range. The keyboard skips over a blocked span.

```html
<et-time-picker [(value)]="slot" [min]="openingTime" [max]="closingTime" [timeFilter]="notDuringLunch" />
```

```ts
const notDuringLunch = (candidate: Date) => candidate.getHours() !== 12;
```

<StoryEmbed id="components-date-time-time-picker--opening-hours" height="420px" />

- `timeFilter` receives the whole timestamp (the candidate time of day on the day of the value being set, today while empty), so opening hours can differ per weekday.
- Every step is evaluated, so a filter can carve out any set of times; runs of blocked steps merge into one span, also across midnight.
- A value set from outside that falls out of bounds is still shown as the selection - bounds gate what a user can pick, they never rewrite the model.

Typed entry in the [time input](/components/date-time-inputs#time-input) and [date-time input](/components/date-time-inputs#date-time-input) is deliberately **not** gated by these bounds - just like the calendar's `minDate`/`maxDate`, they shape the picker, and out-of-range values are a job for a schema validator.

## Keyboard

Each handle is a `role="slider"` and a tab stop. On an empty ring the keys start from the "now" anchor.

| Key                   | Action                     |
| --------------------- | -------------------------- |
| ArrowRight / ArrowUp  | One `minuteStep` later     |
| ArrowLeft / ArrowDown | One `minuteStep` earlier   |
| PageUp / PageDown     | One hour later / earlier   |
| Home / End            | The first / last open time |

Time is cyclic, so the arrows wrap past midnight. Blocked spans are skipped: a key lands on the next open time. Keys with Ctrl, Meta or Alt held are left alone.

## Touch

Below the `md` breakpoint the date and time pickers open as a bottom sheet, where the ring grows to 328px, or to the screen width minus 24px when that is less. The handles keep their size, because a press anywhere on the ring moves the nearest handle. The ring sets `touch-action: none`, so a drag on it does not scroll the sheet.

## Headless usage

`[etTimePicker]` owns all state; `[etTimePickerRing]` is the pointer surface (a press moves the nearest handle, a drag moves it on) and `[etTimePickerRingHandle]` one handle each. Draw the ring however you like:

```html
<div [(value)]="time" etTimePicker>
  <div etTimePickerRing>
    <svg><!-- your track, arc and labels --></svg>
    <button etTimePickerRingHandle></button>
  </div>
</div>
```

| Directive                  | Input   | Type               | Description                                                              |
| -------------------------- | ------- | ------------------ | ------------------------------------------------------------------------ |
| `[etTimePickerRingHandle]` | `side`  | `'start' \| 'end'` | The end of a range the handle sets. `'start'` by default and for single. |
| `[etTimePickerRingHandle]` | `label` | `string \| null`   | Accessible name. Defaults to the `time` label, or the name of the end.   |

The ring directive exposes `spans()` (the open and blocked spans as minutes of the day), `arc()` (the range's start-to-end arc), `empty()` and `draggingSide()`; a handle exposes `minute()`, `angle()` (degrees clockwise from midnight at the top), `active()` and `dragging()`, and mirrors them as `data-active`, `data-dragging`, `data-empty` and `data-side`. A handle outside a ring, or a ring outside a picker, throws - see [error codes](#error-codes).

## Range mode {#range-picker}

`mode="range"` puts a **range** on the same ring: a start handle, an end handle and one arc between them, clockwise from the start - so 22:00 to 06:30 is one arc across midnight. There is no start/end toggle; the active handle is whichever end has focus or was pressed last.

```html
<et-time-picker [(rangeValue)]="slot" mode="range" />
```

<StoryEmbed id="components-date-time-time-picker--range" height="440px" />

`rangeValue` is a `{ start: Date | null; end: Date | null }` model, so `[(rangeValue)]` is enough on its own. A control whose value is a _pair_ of wire strings needs to know which half moved, so picks are also reported side-tagged:

```html
<et-time-picker [rangeValue]="slot()" (timeSelect)="commit($event.side, $event.time)" mode="range" />
```

| Input                     | Type                                                 | Default     | Description                                                                                             |
| ------------------------- | ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `mode`                    | `'single' \| 'range'`                                | `'single'`  | Whether the ring holds `value` or `rangeValue`.                                                         |
| `rangeValue`              | `{ start: Date \| null; end: Date \| null }` (model) | both `null` | The two selected times.                                                                                 |
| `activeSide`              | `'start' \| 'end'` (model)                           | `'start'`   | The end the ring centre shows and whose blocked spans the track draws. Set it with `activeSide.set(…)`. |
| `rangeDays`               | `{ start: Date \| null; end: Date \| null } \| null` | `null`      | The day of each end, from a calendar next to the picker.                                                |
| `timeFilter`              | `(date, side) => boolean`                            | `null`      | Rejects individual times, told which end it is filling.                                                 |
| `startLabel` / `endLabel` | `string \| null`                                     | `null` ¹    | The two handles' accessible names.                                                                      |
| `timeSelect` (output)     | `{ side, time }`                                     | -           | An end became a whole time, and which one.                                                              |
| `rangeHandOff` (output)   | `'start' \| 'end'`                                   | -           | A press on an empty range placed the start and handed the active side on to the end.                    |

¹ `null` falls through to [`TIME_PICKER_LABELS`](/components/localization) (`startTime` / `endTime`: `'Start time'` / `'End time'`).

`format`, `locale`, `minuteStep` and `min`/`max` mean the same as above and apply to both ends.

### Which handle moves

A press moves the handle nearest to the pressed time - a tie goes to the active one - and a drag carries that handle on. Moving a handle makes its end the active side, and a keyboard focus does too, so a form's two fields can drive the ring by focus: the [range inputs](/components/date-time-inputs#time-range-input) bind `activeSide` to the focused field.

From an **empty** range, the first press places the start and hands the active side on to the end **once**, emitting `rangeHandOff`. The range inputs answer by moving focus to the end field on desktop; in the bottom sheet, which covers the fields, they do not.

**Ordering is not enforced**, exactly as in the calendar and the range inputs: an end before its start is a [validator's](/components/forms#validation-accessibility) job. The hook for pushing that rule into the picker instead is `timeFilter`'s side argument - "the end must be after the start" is not expressible as a `min`/`max` bound, because the bound differs per end and moves with the value.

```ts
const endAfterStart = (candidate: Date, side: 'start' | 'end') =>
  side === 'start' || slot().start === null || candidate > slot().start;
```

<StoryEmbed id="components-date-time-time-picker--range-end-after-start" height="440px" />

### Centre readout

With no `rangeDays`, the centre shows the **duration** of the range (`8 h 30 min`) and, when the end is earlier in the day than the start or falls on the next calendar day, the note `ends next day`. With `rangeDays` set - the date-time range input passes the day of each end - the centre shows the time and the day of the active end instead, and the calendar band carries the length. A range that is not complete shows the active end's time under its name.

<StoryEmbed id="components-date-time-time-picker--range-with-days-overnight" height="440px" />

## Accessibility

- Each handle is a `role="slider"` with `aria-valuemin="0"`, `aria-valuemax="1439"` (minutes of the day), `aria-valuenow` and an `aria-valuetext` holding the formatted time. An empty end has no `aria-valuenow` and announces `emptyHint` as its `aria-valuetext`.
- The handle's name is the `time` label; in range mode it is the start or end label, so which end is being edited is announced rather than only drawn.
- The ring graphic is `aria-hidden`; everything it shows is on the handles.
- `disabled` sets `aria-disabled` and `tabindex="-1"` on the handles. The time and date-time inputs pass their own disabled state on; readonly is not forwarded.
- Handle states: hovering lifts a soft halo (a range handle that is not the active one also tints), dragging strengthens the halo and shows the grabbing cursor, and keyboard focus draws a two pixel outline. Each change fades over 120ms, and not at all under `prefers-reduced-motion: reduce`. The track and the arc have no hover style.

## Theming

Selection colors come from the nearest [color theme](/core/theming) (`--et-theme-color-primary-solid`); text and the track use surface tokens. Public design tokens:

| Token                          | Default | Purpose                                                          |
| ------------------------------ | ------- | ---------------------------------------------------------------- |
| `--et-time-picker-ring-size`   | `280px` | Inline and block size of the ring (`328px` in the bottom sheet). |
| `--et-time-picker-handle-size` | `24px`  | Size of a handle.                                                |

## Error codes

The time picker's structural checks live in the shared date & time block - see [error codes](/components/error-codes#date-time-inputs-et30xx) (`ET3022`/`ET3023`).
