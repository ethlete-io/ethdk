# Date & time inputs

Seven form controls for dates, times and durations, all sitting inside the shared
[`et-form-field` shell](/components/forms#the-field-shell) and binding via signal
forms: [date](#date-input), [date range](#date-range-input), [time](#time-input),
[time range](#time-range-input), [date-time](#date-time-input),
[date-time range](#date-time-range-input) and [duration](#duration-input). See the
[Forms overview](/components/forms) for the field chrome, validation and
mixed-state contracts they inherit.

```ts
import { FORM_FIELD_IMPORTS, DATE_INPUT_IMPORTS } from '@ethlete/components';
```

| Array                           | Contains                   |
| ------------------------------- | -------------------------- |
| `DATE_INPUT_IMPORTS`            | `et-date-input`            |
| `DATE_RANGE_INPUT_IMPORTS`      | `et-date-range-input`      |
| `TIME_INPUT_IMPORTS`            | `et-time-input`            |
| `TIME_RANGE_INPUT_IMPORTS`      | `et-time-range-input`      |
| `DATE_TIME_INPUT_IMPORTS`       | `et-date-time-input`       |
| `DATE_TIME_RANGE_INPUT_IMPORTS` | `et-date-time-range-input` |
| `DURATION_INPUT_IMPORTS`        | `et-duration-input`        |

## Shared behavior

The date/time family (everything except the duration input, which is a distinct
scalar - see below) shares one design:

- **String wire value in a configurable format.** The form value is a `string`
  in `valueFormat`; string↔`Date` conversion happens only in the control - the
  [calendar](/components/calendar) and [time picker](/components/time-picker)
  overlays operate on `Date` objects.
- **Typed entry + anchored picker.** Typed text is parsed against `displayFormat`
  (strictly for dates, leniently for times). Unparseable text stays visible, the
  `parseError` signal turns on and the value clears to `null` - once touched,
  it's announced as a real error (`parseErrorMessage`) with matching
  `aria-invalid`/`aria-describedby`. <kbd>Alt</kbd>+<kbd>ArrowDown</kbd> opens the
  picker.
- **A commit is an edit, and only an edit.** Typed text commits on blur and on
  <kbd>Enter</kbd>. Focusing a field and leaving it again without typing commits
  nothing, so a `displayFormat` that carries fewer units than `valueFormat` (the
  date input's date-only default against a time-bearing wire format, say) can
  never silently drop the rest of the value. Erasing text that didn't parse
  resets `parseError` and clears the value. A `readonly` or `disabled` control
  commits nothing at all - tabbing through one leaves its value untouched.
- **Opt-in typing mask.** With `mask` set, a fixed-width numeric `displayFormat`
  (`dd.MM.yyyy`, `MM/dd/yyyy`, `HH:mm`, …) drives a live
  [input mask](/components/text-inputs#masked-input) - guide placeholders
  (`__.__.____`) while focused, auto-inserted separators, filtered pastes, and a
  numeric soft keyboard (`inputmode="numeric"`). Formats the mask can't represent
  (locale formats like `P`/`p`/`Pp`, variable-width or text tokens) are refused
  with a dev-mode warning and typing stays unmasked.
- **Clear (×) button.** While the focused field holds a value or pending text, a
  pointer-only clear button renders before the picker trigger (label:
  `clearLabel`); disable it with `clearable="false"`. Keyboard users clear by
  erasing the text. Both buttons render in the field's
  [suffix stack](/components/forms#one-suffix-stack) (`.et-input-clear` /
  `.et-input-picker-trigger`), so a busy spinner or your own `etInputSuffix` never displaces them.
- **Bottom sheet on mobile.** Below the `md` breakpoint (768px) the picker opens
  as a bottom sheet (backdrop, drag-to-dismiss, touch-sized cells) instead of an
  anchored panel.
- **Range controls stack when the field gets narrow.** The three range controls
  put their two fields side by side, and switch to one per line - start above end,
  the `–` separator dropped - once the control is too narrow to show both formatted
  values at once. It keys off the control's own inline size, not the viewport, so a
  field in a narrow column stacks on a wide screen too; the threshold is in `em`, so
  it follows the field's `size`. Each control's threshold is the width its default
  `displayFormat` needs (`P`, `p`, `Pp`) - a much longer custom format can still
  clip before it stacks. See the `Narrow` story of each range control.
- **A picker that never changes sides while open.** The panel opens below the
  field and only above it when less than `340px` are left below - the tallest a
  picker panel gets, so every one of its views fits on the side it picked. The
  decision reads the space around the field, never the panel's own height
  ([`minAvailableSpace`](/components/overlays#anchored-overlays-and-the-arrow)),
  so drilling from the day grid to the month or year grid resizes the panel in
  place instead of dropping it to the other side of the field. If neither side has
  `340px`, the roomier one wins and the panel shrinks into it.

The wire defaults come from injectable tokens so an app can set them once, and
`date-fns` (v4) is a peer dependency (`yarn add date-fns`):

```ts
import { provideDateFormat, provideTimeFormat, provideDateLocale } from '@ethlete/components';
import { de } from 'date-fns/locale';

providers: [provideDateFormat('yyyy-MM-dd'), provideTimeFormat('HH:mm:ss'), provideDateLocale(de)];
```

## Date input - `et-date-input` {#date-input}

A date control combining typed entry with an anchored
[calendar](/components/calendar) picker.

```html
<et-form-field>
  <et-label>Date</et-label>
  <et-date-input [formField]="demoForm.date" valueFormat="yyyy-MM-dd" />
</et-form-field>
```

<StoryEmbed id="components-forms-date-input--default" height="560px" />

| Input                 | Type                                         | Default             | Description                                                                  |
| --------------------- | -------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `valueFormat`         | `string`                                     | `DATE_FORMAT` token | date-fns format of the string value (token default: ISO 8601 with offset).   |
| `displayFormat`       | `string \| null`                             | `null` ⁴            | date-fns format shown in and parsed from the field (locale-aware).           |
| `precision`           | `'day' \| 'month' \| 'year'`                 | `'day'`             | Which unit the value names - `'month'` makes this a month picker.            |
| `weekNumbers`         | `boolean`                                    | `false`             | Renders the picker calendar's week-number column.                            |
| `locale`              | `Locale \| null` (date-fns)                  | `DATE_LOCALE` token | Display/parse locale.                                                        |
| `minDate` / `maxDate` | `Date \| null`                               | `null`              | Forwarded to the picker calendar (`min`/`max` are reserved by signal forms). |
| `dateFilter`          | `((date: Date) => boolean) \| null`          | `null`              | Forwarded to the picker calendar.                                            |
| `startAt`             | `Date \| null`                               | `null`              | Month the picker calendar opens at while the value is empty.                 |
| `startView`           | `'month' \| 'year' \| 'multiYear'`           | `'month'`           | Which grid the picker calendar opens on.                                     |
| `dateClass`           | `(date, view) => string \| string[] \| null` | `null`              | Per-cell classes for the picker calendar.                                    |
| `pickerOpen`          | `boolean` (model)                            | `false`             | The picker overlay's open state.                                             |
| `pickerTriggerLabel`  | `string \| null`                             | `null` ¹            | `aria-label` of the suffix calendar button.                                  |
| `parseErrorMessage`   | `string \| null`                             | `null` ²            | Message shown below the field when typed text can't be parsed.               |
| `clearable`           | `boolean`                                    | `true`              | Clear (×) button while the focused field has a value (label: `clearLabel`).  |
| `mask`                | `boolean`                                    | `false`             | Opt-in typing mask derived from a fixed-width numeric `displayFormat`.       |

¹ `null` falls through to [`DATE_TIME_LABELS`](/components/localization) (`'Open calendar'`, and the matching `openTimePicker` / `openDateTimePicker` for the other controls).
² `null` falls through to [`DATE_TIME_LABELS`](/components/localization) - `invalidDate` here, and the matching `invalidTime` / `invalidDateTime` / `invalidDateRange` / `invalidDateTimeRange` / `invalidDuration` for the other controls.
³ `null` falls through to [`DATE_TIME_LABELS`](/components/localization) (`'Date'` / `'Time'`, and `'Dates'` / `'Start time'` / `'End time'` on the range picker).
⁴ `null` derives the format from `precision`: the locale's short date (`'P'`) at day precision, that same pattern without its day at month precision, `'yyyy'` at year precision.

Typed text is parsed **strictly** against `displayFormat` on blur/Enter. Picking
a day writes `format(date, valueFormat)` and closes the picker (a named
`role="dialog"`). `startView` and `dateClass` reach the calendar inside it - see
[view drilling](/components/calendar#view-drilling); a month or year picked while
drilling only navigates, so the field commits on the day pick as always.

<StoryEmbed id="components-forms-date-input--masked" height="360px" />

### Precision {#precision}

`precision` turns the control into a month or year picker. It changes three things together: the text format (so the field reads `07/2026` - and a typing mask can be derived from it, which `'P'` never allowed, since the derived pattern is fixed-width), the picker calendar's selecting grid, and the value, which is always the start of the unit whether it was typed or picked. Without that last part, `07/2026` parsed against `MM/yyyy` would inherit today's day of the month from date-fns' reference date.

```html
<et-form-field>
  <et-label>Billing month</et-label>
  <et-date-input [formField]="demoForm.month" precision="month" valueFormat="yyyy-MM" />
</et-form-field>
```

<StoryEmbed id="components-forms-date-input--month-precision" height="360px" />

Naming a `displayFormat` yourself still wins over the derived one. The range input takes `precision` the same way, for month ranges like `07/2025 – 03/2026`; see [the calendar's precision](/components/calendar#month-and-year-pickers) for how the picker behaves there. The two date-time controls have none - their values carry a time.

### Time zones {#time-zones}

By default every `Date` in this family is read and written in the **runtime's own zone**. date-fns'
`startOfDay`, `isSameDay` and `format` all work on local wall-clock time, so "the 30th" means the
30th where the browser is, and the default `valueFormat` (`yyyy-MM-dd'T'HH:mm:ssxxx`) writes that
instant with the local offset.

That is right for _an instant_ - when something happened - and wrong for _a date someone chose_. A
value of `2026-07-30T00:00:00+02:00` read in a browser set to UTC is July 29th at 22:00, so the picker
highlights the 29th. Nothing is broken; the two readings disagree because the value pinned an instant
when what was meant was a day.

**If the value is a calendar date, store it as one.** `valueFormat="yyyy-MM-dd"` (or `precision`'s
`yyyy-MM` / `yyyy`) writes no time and no offset, so it reads back as the same day in every zone:

```html
<et-date-input [formField]="demoForm.date" valueFormat="yyyy-MM-dd" />
```

#### Showing a field in another zone {#value-time-zone}

When the value genuinely is an instant somewhere else - a booking in the venue's zone, a broadcast
window in the studio's - `et-date-time-input` and `et-date-time-range-input` take a `timeZone`:

```html
<et-date-time-input [formField]="demoForm.doorsOpen" timeZone="Asia/Tokyo" />
```

<StoryEmbed id="components-forms-date-time-input--time-zone" height="420px" />

`timeZone` takes an IANA name. It changes three things and nothing else:

1. The field, the picker calendar and the time picker all read and write **that zone's wall clock**.
2. The value is written with **that zone's offset** (`2026-08-18T14:00:00+09:00`), not the reader's.
3. A second line under the field names the zone and gives the same moment in the **reader's own**
   zone. It appears only while the two disagree, and it carries the date only when the reader's day
   differs - so a date showing up there is the signal that the two are not on the same day at all.

The value stays an instant throughout. Nothing about the wire contract changes: the string still
names one moment, and any reader in any zone resolves it to the same one. Only which wall clock the
control shows, and which offset it writes, follow `timeZone`.

Give the reader a friendlier name than the IANA one with `timeZoneLabel`:

```html
<et-date-time-input [formField]="demoForm.doorsOpen" timeZone="Asia/Tokyo" timeZoneLabel="Venue time" />
```

A name `Intl` does not know is ignored, and the control stays in the runtime's zone (dev mode warns).

The same input is on the range control, where one second reading covers both ends:

<StoryEmbed id="components-forms-date-time-range-input--time-zone" height="420px" />

#### What `timeZone` is not for {#time-zone-limits}

- **`et-date-input` and `et-date-range-input` do not take one.** A calendar date names no instant, so
  there is no second reading to give. Store it as a date (`valueFormat="yyyy-MM-dd"`) instead.
- **`et-time-input` and `et-time-range-input` do not take one.** An `HH:mm` value has no day, and
  converting a time of day between zones needs one.
- **The scheduler does not take one.** It takes `Date` objects straight from you, so the zone its grid
  draws in is the runtime's. Showing a foreign zone's grid means every day boundary and hour row
  being evaluated in it, which daylight saving makes 23 and 25 hours long - a separate project, not
  this input. Convert at your boundary if you need it today.
- **One hour a year, the picker highlight can be an hour out.** The calendar and the time picker are
  handed a plain `Date` carrying the zone's wall clock, and the reader's own spring-forward hour has
  no such local wall clock. The committed value is always exact - it is rebuilt from the zone, never
  from that stand-in - so only the highlight is affected, and only in that hour.

## Date range input - `et-date-range-input` {#date-range-input}

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
`minDate`/`maxDate`/`dateFilter`, `startAt`, `startView`, `dateClass`, `precision`,
`weekNumbers`, `pickerOpen`), plus `comparisonStart`/`comparisonEnd` for the picker's
[comparison band](/components/calendar#comparison-ranges) and `rangeSelectionStrategy`
for [snapping picks](/components/calendar#range-selection-strategies), with
`startPlaceholder`/`endPlaceholder` and per-field `startAriaLabel`/`endAriaLabel`
(defaults `'Start date'`/`'End date'`; the host is a `role="group"` labelled by
the field label). The opt-in typing mask applies to both fields - each side is
its own mask host, so the guide only shows on the focused side. In the picker,
the first click starts the range and a completed range closes it; a partial pick
keeps it open. See the `Masked` story.

**Validation:** child-path errors (e.g. `required(s.range.start)`) show in the
field's single error area alongside errors on the range path itself:

```ts
validate(s.range, ({ value }) => {
  const { start, end } = value();

  return start !== null && end !== null && start > end
    ? { kind: 'range-order', message: 'The start date must be before the end date' }
    : null;
});
```

## Time input - `et-time-input` {#time-input}

A time control (default wire format `HH:mm`) combining **lenient** typed entry
with an anchored [time picker](/components/time-picker) overlay.

```html
<et-form-field>
  <et-label>Time</et-label>
  <et-time-input [formField]="demoForm.time" />
</et-form-field>
```

| Input                       | Type                                | Default             | Description                                                                                 |
| --------------------------- | ----------------------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `valueFormat`               | `string`                            | `TIME_FORMAT` token | date-fns format of the string value (token default: `HH:mm`).                               |
| `displayFormat`             | `string`                            | `'p'`               | date-fns format shown in and parsed from the field (locale-aware).                          |
| `locale`                    | `Locale \| null` (date-fns)         | `DATE_LOCALE` token | Display/parse locale (also decides the picker's 12/24-hour layout).                         |
| `minuteStep` / `secondStep` | `number`                            | `5` / `1`           | Forwarded to the picker columns, clamped to at least 1.                                     |
| `minTime` / `maxTime`       | `Date \| null`                      | `null`              | Bound the picker's time of day (`min`/`max` are reserved by signal forms).                  |
| `timeFilter`                | `((date: Date) => boolean) \| null` | `null`              | Rejects individual times in the picker.                                                     |
| `pickerOpen`                | `boolean` (model)                   | `false`             | The picker overlay's open state.                                                            |
| `pickerTriggerLabel`        | `string \| null`                    | `null` ¹            | `aria-label` of the suffix clock button.                                                    |
| `parseErrorMessage`         | `string \| null`                    | `null` ²            | Message shown below the field when typed text can't be parsed.                              |
| `clearable`                 | `boolean`                           | `true`              | Clear (×) button while the focused field has a value or pending text (label: `clearLabel`). |
| `mask`                      | `boolean`                           | `false`             | Opt-in typing mask - needs a fixed-width `displayFormat` like `HH:mm`.                      |

Typed text is parsed against `displayFormat` first, then **leniently**: bare
digit runs (`930` → 09:30, `0930`, `93015`), loose separators (`9.30`, `9 30`)
and meridiem suffixes (`930pm`, `9 a.m.`) all commit, and 24-hour entry is
accepted even under a 12-hour display format. Picking parts writes
`format(time, valueFormat)` and - unlike the calendar picker - **keeps the
overlay open**, since a time takes one pick per column. See the `Default` and
`With seconds` stories.

`minTime` / `maxTime` / `timeFilter` are forwarded to the picker and follow its
[bounds and filtering](/components/time-picker#bounds-and-filtering) rules - only the
bounds' time of day is read, and unselectable options stay in place, dimmed. They shape
the **picker** only: typed entry is not gated by them (the same split the date inputs make
with `minDate`/`maxDate`), so pair them with a schema validator when the form must reject
out-of-range times.

<StoryEmbed id="components-forms-time-input--opening-hours" height="560px" />

## Time range input - `et-time-range-input` {#time-range-input}

One registered form control containing two text inputs (start – end) that share a
single range-mode [**time picker**](/components/time-picker#range-picker) - one set of
columns holding both ends, switched between by name. The value shape is the date range
input's `{ start: string | null; end: string | null }`, both strings in the time
`valueFormat`; each side commits exactly like the single time input. Reach for it
wherever an opening hour and a closing hour belong together - a shift, a slot, a
daily window - instead of pairing two `et-time-input`s.

```html
<et-form-field>
  <et-label>Opening hours</et-label>
  <et-time-range-input [formField]="demoForm.hours" />
</et-form-field>
```

<StoryEmbed id="components-forms-time-range-input--prefilled" height="560px" />

| Input                                 | Type                                                        | Default             | Description                                                            |
| ------------------------------------- | ----------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| `valueFormat`                         | `string`                                                    | `TIME_FORMAT` token | date-fns format of both string values (token default: `HH:mm`).        |
| `displayFormat`                       | `string`                                                    | `'p'`               | date-fns format shown in and parsed from both fields (locale-aware).   |
| `locale`                              | `Locale \| null` (date-fns)                                 | `DATE_LOCALE` token | Display/parse locale (also decides the picker's 12/24-hour layout).    |
| `minuteStep` / `secondStep`           | `number`                                                    | `5` / `1`           | Forwarded to the picker columns, clamped to at least 1.                |
| `minTime` / `maxTime`                 | `Date \| null`                                              | `null`              | Bound the picker's time of day, for both ends.                         |
| `timeFilter`                          | `((date: Date, side: 'start' \| 'end') => boolean) \| null` | `null`              | Rejects individual times; receives the end being filled.               |
| `startPlaceholder` / `endPlaceholder` | `string`                                                    | `''`                | Placeholders of the two fields.                                        |
| `startAriaLabel` / `endAriaLabel`     | `string \| null`                                            | `null` ³            | `aria-label`s of the two fields (`'Start time'` / `'End time'`).       |
| `startTimeLabel` / `endTimeLabel`     | `string \| null`                                            | `null` ³            | Names of the two ends on the picker's own side switch.                 |
| `pickerOpen`                          | `boolean` (model)                                           | `false`             | The picker overlay's open state.                                       |
| `pickerTriggerLabel`                  | `string \| null`                                            | `null` ¹            | `aria-label` of the suffix clock button.                               |
| `parseErrorMessage`                   | `string \| null`                                            | `null` ²            | Message shown below the field when either side's text can't be parsed. |
| `clearable`                           | `boolean`                                                   | `true`              | Clear (×) button while the field is in use (label: `clearLabel`).      |
| `mask`                                | `boolean`                                                   | `false`             | Opt-in typing mask - needs a fixed-width `displayFormat` like `HH:mm`. |

Each side parses **leniently**, with the single time input's rules (`930` → 09:30,
`930pm` → 21:30). The picker **never closes on its own**: filling one end still leaves
the other to set, so the reader closes it (Escape, outside click, the trigger). Picking
a part writes only the active end - which one that is, is the side switch's job, and it
auto-advances to the end exactly once, after the first activation of a start option.

The host is a `role="group"` labelled by the field label. There is no calendar here,
so the picker has no panes and no tabs: the bottom sheet below the `md` breakpoint
shows the same single set of columns.

**Ordering is not enforced.** The control never reorders or clamps the two ends - same
contract as the other two ranges - so an end before the start is a
[validator's](/components/forms#validation) job. What the picker _can_ express is the
same rule as a bound, because `timeFilter` receives the side it is filling:

```ts
const endAfterStart = (candidate: Date, side: 'start' | 'end') => {
  const start = hours().start; // the committed `HH:mm` wire value

  return side === 'start' || start === null || format(candidate, 'HH:mm') > start;
};
```

<StoryEmbed id="components-forms-time-range-input--end-after-start" height="560px" />

## Date-time input - `et-date-time-input` {#date-time-input}

A combined date & time control (default wire format: the `DATE_FORMAT` token, ISO
8601 with offset - it already carries the time). One field, one combined display
format; the anchored picker overlay hosts a [calendar](/components/calendar) and
a [time picker](/components/time-picker) **side by side** and stays open across
picks. Below the `md` breakpoint the picker opens as a bottom sheet with **Date /
Time tabs** switching between the two panes; picking a day carries the tabs on to
the time pane, the bottom sheet's version of the panel showing both at once. That
happens **once** - after it, the tabs stay where they are put, so going back to
correct the day is never interrupted.

```html
<et-form-field>
  <et-label>Kick-off</et-label>
  <et-date-time-input [formField]="demoForm.kickOff" />
</et-form-field>
```

<StoryEmbed id="components-forms-date-time-input--default" height="560px" />

| Input                           | Type                                         | Default             | Description                                                                                 |
| ------------------------------- | -------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `valueFormat`                   | `string`                                     | `DATE_FORMAT` token | date-fns format of the string value (token default: ISO 8601 with offset).                  |
| `displayFormat`                 | `string`                                     | `'Pp'`              | Combined date-fns format shown in and parsed from the field (locale-aware).                 |
| `timeZone`                      | `string \| null`                             | `null`              | IANA zone the field's wall clock stands for - see [time zones](#value-time-zone).           |
| `timeZoneLabel`                 | `string \| null`                             | `null`              | Name shown for `timeZone`. Defaults to the IANA name's last segment.                        |
| `locale`                        | `Locale \| null` (date-fns)                  | `DATE_LOCALE` token | Display/parse locale (also decides the time picker's 12/24-hour layout).                    |
| `minDate` / `maxDate`           | `Date \| null`                               | `null`              | Forwarded to the picker calendar (`min`/`max` are reserved by signal forms).                |
| `dateFilter`                    | `((date: Date) => boolean) \| null`          | `null`              | Forwarded to the picker calendar.                                                           |
| `startAt`                       | `Date \| null`                               | `null`              | Month the picker calendar opens at while the value is empty.                                |
| `startView`                     | `'month' \| 'year' \| 'multiYear'`           | `'month'`           | Which grid the picker calendar opens on.                                                    |
| `dateClass`                     | `(date, view) => string \| string[] \| null` | `null`              | Per-cell classes for the picker calendar.                                                   |
| `minuteStep` / `secondStep`     | `number`                                     | `5` / `1`           | Forwarded to the time picker columns, clamped to at least 1.                                |
| `minTime` / `maxTime`           | `Date \| null`                               | `null`              | Bound the time pane's time of day (see the time input).                                     |
| `timeFilter`                    | `((date: Date) => boolean) \| null`          | `null`              | Rejects individual times; receives the full candidate timestamp.                            |
| `pickerOpen`                    | `boolean` (model)                            | `false`             | The picker overlay's open state.                                                            |
| `pickerTriggerLabel`            | `string \| null`                             | `null` ¹            | `aria-label` of the suffix calendar button.                                                 |
| `dateTabLabel` / `timeTabLabel` | `string \| null`                             | `null` ³            | Labels of the pane tabs in the bottom sheet.                                                |
| `parseErrorMessage`             | `string \| null`                             | `null` ²            | Message shown below the field when typed text can't be parsed.                              |
| `clearable`                     | `boolean`                                    | `true`              | Clear (×) button while the focused field has a value or pending text (label: `clearLabel`). |
| `mask`                          | `boolean`                                    | `false`             | Opt-in typing mask - needs a fixed-width `displayFormat` like `dd.MM.yyyy HH:mm`.           |

Typed text is parsed **strictly** against `displayFormat` first, then leniently:
the entry is split into a date and a time at any separator (the date against the
locale's short `P` format, the time with the time input's lenient rules -
`7/16/2026 930pm` commits), and a **bare date commits at midnight**.

In the picker, selections **merge**: picking a day keeps the committed time of
day, picking a time keeps the committed day - and neither closes the overlay.

From **empty**, one pick is only half a value, so it is **held** rather than committed:
the field renders the picked half against placeholders (`08/13/2026, __:__ __`), the
picker marks it, and the form value stays `null` until the other half lands. Neither
half is ever invented - a day does not commit at a midnight nobody chose, and a time
does not commit on a today nobody chose. Typing is unaffected: the lenient parser still
commits a bare date at midnight, because there the reader wrote the whole entry.

A held half survives an unedited blur, and is dropped by an edit to the field or by
clearing the control.

The time pane holds its parts the same way: an hour with no minute is not a time either, so
nothing reaches the field until an hour and a minute are both picked. See
[the time picker](/components/time-picker#held-picks).

The date bounds (`minDate`/`maxDate`/`dateFilter`) and the time bounds
(`minTime`/`maxTime`/`timeFilter`) are independent: the first gate the calendar pane, the
second the time pane. Because `timeFilter` receives the full candidate timestamp - the
picked time of day on the **committed day** - it is the hook for anything date-dependent,
e.g. opening hours that differ on weekends:

```ts
const openingHours = (candidate: Date) => {
  const weekend = candidate.getDay() === 0 || candidate.getDay() === 6;
  const hour = candidate.getHours();

  return weekend ? hour >= 10 && hour < 14 : hour >= 9 && hour < 17;
};
```

<StoryEmbed id="components-forms-date-time-input--opening-hours" height="560px" />

## Date-time range input - `et-date-time-range-input` {#date-time-range-input}

The two controls above, combined: one registered form control containing two
text inputs (start – end) that share a single picker holding a range-mode
[calendar](/components/calendar) plus a range-mode
[**time picker**](/components/time-picker#range-picker) - one set of time columns
holding both ends, switched between by name. The value shape is the date range input's
`{ start: string | null; end: string | null }` in `valueFormat`, except both
strings carry a time; each side commits exactly like the single date-time input.
Reach for it wherever a start and an end belong together - a booking, a shift, an
appointment - instead of pairing two `et-date-time-input`s.

```html
<et-form-field>
  <et-label>When</et-label>
  <et-date-time-range-input [formField]="demoForm.slot" />
</et-form-field>
```

<StoryEmbed id="components-forms-date-time-range-input--prefilled" height="620px" />

Options are the union of the two: everything the date range input forwards to the
calendar (`minDate`/`maxDate`/`dateFilter`, `startAt`, `startView`, `dateClass`,
`weekNumbers`) plus everything the date-time input forwards to a time picker
(`minuteStep`, `secondStep`, `minTime`, `maxTime`, `timeFilter`) plus
`timeZone`/`timeZoneLabel` (see [time zones](#value-time-zone) - one second reading
covers both ends), with
`startPlaceholder`/`endPlaceholder` and `startAriaLabel`/`endAriaLabel` (defaults
`'Start date and time'`/`'End date and time'`; the host is a `role="group"`
labelled by the field label). `precision` is absent, as on the single date-time
input - both ends carry a time. It does **not** take the date range input's
`rangeSelectionStrategy` or `comparisonStart`/`comparisonEnd`: week snapping and
comparison bands belong to reporting filters, not to appointments.

Two behaviors differ from the plain date range input, both because a day range is
only half the value here:

- **The picker never closes on its own.** Completing the day range leaves it open,
  because the two times are still to come. The reader closes it (Escape, outside
  click, the trigger).
- **A picked day range keeps each side's committed time of day** - the same merge the
  single date-time input does, once per side, with the same half-picks: a side whose
  time is still missing holds its day and stays `null` in the value until that time
  arrives. Picking a time writes only its own side; while that side has no day yet the
  **other** side's is used (the end of an appointment whose start day is known is on
  that day), and only with no day anywhere is the time held instead.

Below the `md` breakpoint the picker opens as a bottom sheet with **Dates / Times
tabs**; on the anchored panel the calendar and the time picker sit side by side.
Completing the two days carries the tabs on to the times pane - **once**, so going
back to correct them is never interrupted.
`datesTabLabel`/`timesTabLabel` relabel the two tabs, and
`startTimeLabel`/`endTimeLabel` the time picker's own start/end switch.

Because two `Pp` values are long, give the field room - roughly twice a date
range's width - or name a compact `displayFormat` such as `dd.MM.yy HH:mm`.

**Ordering is not enforced.** The control never reorders or clamps the two ends -
same contract as the date range input - so an end before the start is a
[validator's](/components/forms#validation) job:

```ts
validate(s.slot, ({ value }) => {
  const { start, end } = value();

  return start !== null && end !== null && start > end
    ? { kind: 'range-order', message: 'The start must be before the end' }
    : null;
});
```

What the picker _can_ express is the same rule as a bound, because `timeFilter`
receives the side it is filling alongside the candidate timestamp - the one thing
a single-value bound cannot say:

```ts
const endAfterStart = (candidate: Date, side: 'start' | 'end') =>
  side === 'start' || slot().start === null || candidate > parseISO(slot().start);
```

<StoryEmbed id="components-forms-date-time-range-input--end-after-start" height="620px" />

## Duration input - `et-duration-input` {#duration-input}

A duration control whose value is a **total elapsed time in milliseconds**
(`number | null`) - not a `Date`. A duration is a distinct scalar quantity (split
times, race durations, effort windows), so it stays out of the calendar/time
`Date` system and owns its own value contract.

```html
<et-form-field>
  <et-label>Lap time</et-label>
  <et-duration-input [formField]="demoForm.lap" durationFormat="mm:ss" />
</et-form-field>
```

| Input               | Type             | Default   | Description                                                                                 |
| ------------------- | ---------------- | --------- | ------------------------------------------------------------------------------------------- |
| `durationFormat`    | `string`         | `'mm:ss'` | Segment layout - runs of `h`/`m`/`s`/`S` (millis) plus separators.                          |
| `placeholder`       | `string`         | `''`      | Shown on the empty field.                                                                   |
| `parseErrorMessage` | `string \| null` | `null` ²  | Message shown below the field when typed text can't be parsed.                              |
| `clearable`         | `boolean`        | `true`    | Clear (×) button while the focused field has a value or pending text (label: `clearLabel`). |
| `aria-label`        | `string \| null` | `null`    | Names the field when no `et-label` is projected.                                            |
| `aria-labelledby`   | `string \| null` | `null`    | Ids naming the field. Takes precedence over a projected `et-label`.                         |

The format is any arrangement of unit-token runs and separators: `mm:ss`,
`hh:mm:ss`, `hh:mm:ss.SSS`, `h m`. Typed text commits on blur/Enter with a
**lenient parse**: a bare digit run fills from the smallest unit up (`130` →
`01:30`, `90` → `01:30` under `mm:ss`), and separator entry maps left-to-right
(`1:30`, `1:02:03`). Milliseconds are literal and need the decimal separator
(`1:30.500`). Unparseable text is kept visible with a `parseError` (value stays
`null`), exactly like the date/time inputs. The largest unit is unbounded
(`100:00` is a valid `mm:ss` value); validation of any upper bound belongs to the
schema.

Unlike the date/time inputs, the duration input has **no opt-in typing mask** -
and that's deliberate: its first segment is unbounded, so a fixed slot layout
would block valid entries (`100:00`), and its lenient parse fills from the
_smallest_ unit up (`130` → `01:30`) while a mask fills slots left-to-right
(`130` → `13:0…`), silently changing what an established entry habit means.

## Bulk editing

All seven controls implement the SDK-wide
[mixed state contract](/components/mixed-state) and take a `mixedLabel` (default
unset → [`FORM_FIELD_LABELS.mixed`](/components/localization)) shown in place of the value while mixed. See the
[Forms overview](/components/forms#mixed-values-bulk-editing) for the wiring
recipe.

## Accessibility

These controls inherit the field shell's label/error/`aria-describedby` wiring -
see [Validation & accessibility](/components/forms#validation-accessibility) in
the overview. Notes specific to this family:

- A **parse error** (unparseable typed text) is surfaced like any validation
  error once touched: `parseErrorMessage` renders as an `et-form-error` with
  matching `aria-invalid` and `aria-describedby` - no silent invalid state.
- A field in a dense row that cannot carry a visible label takes `aria-label` (or
  `aria-labelledby`) on the control itself - all seven accept both, and forward
  them onto the native field (a range names its `role="group"` host instead,
  where `startAriaLabel` / `endAriaLabel` keep naming the two fields). Writing
  `[attr.aria-label]` instead would land on the wrapper and leave the native
  field unnamed, which throws [`ET2201`](/components/error-codes) in dev mode.
- The picker overlay is a named `role="dialog"` - its name is the control's
  `dialogLabel`, falling through to [`DATE_TIME_LABELS`](/components/localization)
  (`chooseDate`, `chooseTime`, `chooseDateRange`, `chooseTimeRange`,
  `chooseDateTime`, `chooseDateTimeRange`). All three range hosts are a
  `role="group"` labelled by the field label. Inside the date-time range picker,
  which of the two times the columns are editing is announced by the time picker's
  own `aria-pressed` side switch.
- <kbd>Alt</kbd>+<kbd>ArrowDown</kbd> opens the picker from the field.

## Theming

These controls render entirely through the [`et-form-field` shell](/components/forms#theming),
the [calendar](/components/calendar#theming) and the
[time picker](/components/time-picker#theming) - see those guides for their
tokens. All colors resolve through the app-registered
[surface/color theme systems](/core/theming).

## Error codes

The date & time inputs throw in the
[`ET30xx`](/components/error-codes#date-time-inputs-et30xx) range.
