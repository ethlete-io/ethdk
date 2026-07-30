# Date & time inputs

Five form controls for dates, times and durations, all sitting inside the shared
[`et-form-field` shell](/components/forms#the-field-shell) and binding via signal
forms: [date](#date-input), [date range](#date-range-input), [time](#time-input),
[date-time](#date-time-input) and [duration](#duration-input). See the
[Forms overview](/components/forms) for the field chrome, validation and
mixed-state contracts they inherit.

```ts
import { FORM_FIELD_IMPORTS, DATE_INPUT_IMPORTS } from '@ethlete/components';
```

| Array                      | Contains              |
| -------------------------- | --------------------- |
| `DATE_INPUT_IMPORTS`       | `et-date-input`       |
| `DATE_RANGE_INPUT_IMPORTS` | `et-date-range-input` |
| `TIME_INPUT_IMPORTS`       | `et-time-input`       |
| `DATE_TIME_INPUT_IMPORTS`  | `et-date-time-input`  |
| `DURATION_INPUT_IMPORTS`   | `et-duration-input`   |

## Shared behavior

The date/time family (everything except the duration input, which is a distinct
scalar — see below) shares one design:

- **String wire value in a configurable format.** The form value is a `string`
  in `valueFormat`; string↔`Date` conversion happens only in the control — the
  [calendar](/components/calendar) and [time picker](/components/time-picker)
  overlays operate on `Date` objects.
- **Typed entry + anchored picker.** Typed text is parsed against `displayFormat`
  (strictly for dates, leniently for times). Unparseable text stays visible, the
  `parseError` signal turns on and the value clears to `null` — once touched,
  it's announced as a real error (`parseErrorMessage`) with matching
  `aria-invalid`/`aria-describedby`. <kbd>Alt</kbd>+<kbd>ArrowDown</kbd> opens the
  picker.
- **Opt-in typing mask.** With `mask` set, a fixed-width numeric `displayFormat`
  (`dd.MM.yyyy`, `MM/dd/yyyy`, `HH:mm`, …) drives a live
  [input mask](/components/text-inputs#masked-input) — guide placeholders
  (`__.__.____`) while focused, auto-inserted separators, filtered pastes, and a
  numeric soft keyboard (`inputmode="numeric"`). Formats the mask can't represent
  (locale formats like `P`/`p`/`Pp`, variable-width or text tokens) are refused
  with a dev-mode warning and typing stays unmasked.
- **Clear (×) button.** While the focused field holds a value or pending text, a
  pointer-only clear button renders before the picker trigger (label:
  `clearLabel`); disable it with `clearable="false"`. Keyboard users clear by
  erasing the text.
- **Bottom sheet on mobile.** Below the `md` breakpoint (768px) the picker opens
  as a bottom sheet (backdrop, drag-to-dismiss, touch-sized cells) instead of an
  anchored panel.

The wire defaults come from injectable tokens so an app can set them once, and
`date-fns` (v4) is a peer dependency (`yarn add date-fns`):

```ts
import { provideDateFormat, provideTimeFormat, provideDateLocale } from '@ethlete/components';
import { de } from 'date-fns/locale';

providers: [provideDateFormat('yyyy-MM-dd'), provideTimeFormat('HH:mm:ss'), provideDateLocale(de)];
```

## Date input — `et-date-input` {#date-input}

A date control combining typed entry with an anchored
[calendar](/components/calendar) picker.

```html
<et-form-field>
  <et-label>Date</et-label>
  <et-date-input [formField]="demoForm.date" valueFormat="yyyy-MM-dd" />
</et-form-field>
```

<StoryEmbed id="components-forms-date-input--default" height="560px" />

| Input                 | Type                                | Default             | Description                                                                  |
| --------------------- | ----------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `valueFormat`         | `string`                            | `DATE_FORMAT` token | date-fns format of the string value (token default: ISO 8601 with offset).   |
| `displayFormat`       | `string`                            | `'P'`               | date-fns format shown in and parsed from the field (locale-aware).           |
| `locale`              | `Locale \| null` (date-fns)         | `DATE_LOCALE` token | Display/parse locale.                                                        |
| `minDate` / `maxDate` | `Date \| null`                      | `null`              | Forwarded to the picker calendar (`min`/`max` are reserved by signal forms). |
| `dateFilter`          | `((date: Date) => boolean) \| null` | `null`              | Forwarded to the picker calendar.                                            |
| `pickerOpen`          | `boolean` (model)                   | `false`             | The picker overlay's open state.                                             |
| `pickerTriggerLabel`  | `string \| null`                    | `null` ¹            | `aria-label` of the suffix calendar button.                                  |
| `parseErrorMessage`   | `string \| null`                    | `null` ²            | Message shown below the field when typed text can't be parsed.               |
| `clearable`           | `boolean`                           | `true`              | Clear (×) button while the focused field has a value (label: `clearLabel`).  |
| `mask`                | `boolean`                           | `false`             | Opt-in typing mask derived from a fixed-width numeric `displayFormat`.       |

¹ `null` falls through to [`DATE_TIME_LABELS`](/components/localization) (`'Open calendar'`, and the matching `openTimePicker` / `openDateTimePicker` for the other controls).
² `null` falls through to [`DATE_TIME_LABELS`](/components/localization) — `invalidDate` here, and the matching `invalidTime` / `invalidDateTime` / `invalidDateRange` / `invalidDuration` for the other controls.
³ `null` falls through to [`DATE_TIME_LABELS`](/components/localization) (`'Date'` / `'Time'`).

Typed text is parsed **strictly** against `displayFormat` on blur/Enter. Picking
a day writes `format(date, valueFormat)` and closes the picker (a named
`role="dialog"`).

<StoryEmbed id="components-forms-date-input--masked" height="360px" />

## Date range input — `et-date-range-input` {#date-range-input}

One registered form control containing two text inputs (start – end) that share a
single range-mode [calendar](/components/calendar) picker. The value shape is
`{ start: string | null; end: string | null }` in `valueFormat`; each side
commits exactly like the single date input.

```html
<et-form-field>
  <et-label>Date range</et-label>
  <et-date-range-input [formField]="demoForm.range" valueFormat="yyyy-MM-dd" />
</et-form-field>
```

Options mirror the date input (`valueFormat`, `displayFormat`, `locale`, `mask`,
`minDate`/`maxDate`/`dateFilter`, `pickerOpen`), with
`startPlaceholder`/`endPlaceholder` and per-field `startAriaLabel`/`endAriaLabel`
(defaults `'Start date'`/`'End date'`; the host is a `role="group"` labelled by
the field label). The opt-in typing mask applies to both fields — each side is
its own mask host, so the guide only shows on the focused side. In the picker,
the first click starts the range and a completed range closes it; a partial pick
keeps it open. See the `Masked` story.

**Validation:** signal forms attaches child-path errors (e.g.
`required(s.range.start)`) to the sub-fields — they flip the control's invalid
state, but their messages don't reach the field's single error area. Validate on
the range path for messages you want displayed:

```ts
validate(s.range, ({ value }) => {
  const { start, end } = value();

  return start !== null && end !== null && start > end
    ? { kind: 'range-order', message: 'The start date must be before the end date' }
    : null;
});
```

## Time input — `et-time-input` {#time-input}

A time control (default wire format `HH:mm`) combining **lenient** typed entry
with an anchored [time picker](/components/time-picker) overlay.

```html
<et-form-field>
  <et-label>Time</et-label>
  <et-time-input [formField]="demoForm.time" />
</et-form-field>
```

| Input                       | Type                        | Default              | Description                                                            |
| --------------------------- | --------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `valueFormat`               | `string`                    | `TIME_FORMAT` token  | date-fns format of the string value (token default: `HH:mm`).          |
| `displayFormat`             | `string`                    | `'p'`                | date-fns format shown in and parsed from the field (locale-aware).     |
| `locale`                    | `Locale \| null` (date-fns) | `DATE_LOCALE` token  | Display/parse locale (also decides the picker's 12/24-hour layout).    |
| `minuteStep` / `secondStep` | `number`                    | `5` / `1`            | Forwarded to the picker columns.                                       |
| `pickerOpen`                | `boolean` (model)           | `false`              | The picker overlay's open state.                                       |
| `pickerTriggerLabel`        | `string`                    | `'Open time picker'` | `aria-label` of the suffix clock button.                               |
| `mask`                      | `boolean`                   | `false`              | Opt-in typing mask — needs a fixed-width `displayFormat` like `HH:mm`. |

Typed text is parsed against `displayFormat` first, then **leniently**: bare
digit runs (`930` → 09:30, `0930`, `93015`), loose separators (`9.30`, `9 30`)
and meridiem suffixes (`930pm`, `9 a.m.`) all commit, and 24-hour entry is
accepted even under a 12-hour display format. Picking parts writes
`format(time, valueFormat)` and — unlike the calendar picker — **keeps the
overlay open**, since a time takes one pick per column. See the `Default` and
`With seconds` stories.

## Date-time input — `et-date-time-input` {#date-time-input}

A combined date & time control (default wire format: the `DATE_FORMAT` token, ISO
8601 with offset — it already carries the time). One field, one combined display
format; the anchored picker overlay hosts a [calendar](/components/calendar) and
a [time picker](/components/time-picker) **side by side** and stays open across
picks. Below the `md` breakpoint the picker opens as a bottom sheet with **Date /
Time tabs** switching between the two panes.

```html
<et-form-field>
  <et-label>Kick-off</et-label>
  <et-date-time-input [formField]="demoForm.kickOff" />
</et-form-field>
```

<StoryEmbed id="components-forms-date-time-input--default" height="560px" />

| Input                           | Type                                | Default                     | Description                                                                       |
| ------------------------------- | ----------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| `valueFormat`                   | `string`                            | `DATE_FORMAT` token         | date-fns format of the string value (token default: ISO 8601 with offset).        |
| `displayFormat`                 | `string`                            | `'Pp'`                      | Combined date-fns format shown in and parsed from the field (locale-aware).       |
| `locale`                        | `Locale \| null` (date-fns)         | `DATE_LOCALE` token         | Display/parse locale (also decides the time picker's 12/24-hour layout).          |
| `minDate` / `maxDate`           | `Date \| null`                      | `null`                      | Forwarded to the picker calendar (`min`/`max` are reserved by signal forms).      |
| `dateFilter`                    | `((date: Date) => boolean) \| null` | `null`                      | Forwarded to the picker calendar.                                                 |
| `minuteStep` / `secondStep`     | `number`                            | `5` / `1`                   | Forwarded to the time picker columns.                                             |
| `pickerOpen`                    | `boolean` (model)                   | `false`                     | The picker overlay's open state.                                                  |
| `pickerTriggerLabel`            | `string`                            | `'Open date & time picker'` | `aria-label` of the suffix calendar button.                                       |
| `dateTabLabel` / `timeTabLabel` | `string \| null`                    | `null` ³                    | Labels of the pane tabs in the bottom sheet.                                      |
| `mask`                          | `boolean`                           | `false`                     | Opt-in typing mask — needs a fixed-width `displayFormat` like `dd.MM.yyyy HH:mm`. |

Typed text is parsed **strictly** against `displayFormat` first, then leniently:
the entry is split into a date and a time at any separator (the date against the
locale's short `P` format, the time with the time input's lenient rules —
`7/16/2026 930pm` commits), and a **bare date commits at midnight**. In the
picker, selections **merge**: picking a day keeps the committed time of day,
picking a time keeps the committed day — and neither closes the overlay. While
the value is still empty, a first day pick commits the day **at midnight** (the
time never defaults to the current wall-clock time); a first time pick completes
with today as the day.

## Duration input — `et-duration-input` {#duration-input}

A duration control whose value is a **total elapsed time in milliseconds**
(`number | null`) — not a `Date`. A duration is a distinct scalar quantity (split
times, race durations, effort windows), so it stays out of the calendar/time
`Date` system and owns its own value contract.

```html
<et-form-field>
  <et-label>Lap time</et-label>
  <et-duration-input [formField]="demoForm.lap" durationFormat="mm:ss" />
</et-form-field>
```

| Input            | Type     | Default   | Description                                                        |
| ---------------- | -------- | --------- | ------------------------------------------------------------------ |
| `durationFormat` | `string` | `'mm:ss'` | Segment layout — runs of `h`/`m`/`s`/`S` (millis) plus separators. |
| `placeholder`    | `string` | `''`      | Shown on the empty field.                                          |

The format is any arrangement of unit-token runs and separators: `mm:ss`,
`hh:mm:ss`, `hh:mm:ss.SSS`, `h m`. Typed text commits on blur/Enter with a
**lenient parse**: a bare digit run fills from the smallest unit up (`130` →
`01:30`, `90` → `01:30` under `mm:ss`), and separator entry maps left-to-right
(`1:30`, `1:02:03`). Milliseconds are literal and need the decimal separator
(`1:30.500`). Unparseable text is kept visible with a `parseError` (value stays
`null`), exactly like the date/time inputs. The largest unit is unbounded
(`100:00` is a valid `mm:ss` value); validation of any upper bound belongs to the
schema.

Unlike the date/time inputs, the duration input has **no opt-in typing mask** —
and that's deliberate: its first segment is unbounded, so a fixed slot layout
would block valid entries (`100:00`), and its lenient parse fills from the
_smallest_ unit up (`130` → `01:30`) while a mask fills slots left-to-right
(`130` → `13:0…`), silently changing what an established entry habit means.

## Bulk editing

All five controls implement the SDK-wide
[mixed state contract](/components/mixed-state) and take a `mixedLabel` (default
unset → [`FORM_FIELD_LABELS.mixed`](/components/localization)) shown in place of the value while mixed. See the
[Forms overview](/components/forms#mixed-values-bulk-editing) for the wiring
recipe.

## Accessibility

These controls inherit the field shell's label/error/`aria-describedby` wiring —
see [Validation & accessibility](/components/forms#validation-accessibility) in
the overview. Notes specific to this family:

- A **parse error** (unparseable typed text) is surfaced like any validation
  error once touched: `parseErrorMessage` renders as an `et-form-error` with
  matching `aria-invalid` and `aria-describedby` — no silent invalid state.
- The picker overlay is a named `role="dialog"`; the date range host is a
  `role="group"` labelled by the field label.
- <kbd>Alt</kbd>+<kbd>ArrowDown</kbd> opens the picker from the field.

## Theming

These controls render entirely through the [`et-form-field` shell](/components/forms#theming),
the [calendar](/components/calendar#theming) and the
[time picker](/components/time-picker#theming) — see those guides for their
tokens. All colors resolve through the app-registered
[surface/color theme systems](/core/theming).

## Error codes

The date & time inputs throw in the
[`ET30xx`](/components/error-codes#date-time-inputs-et30xx) range.
