# date-time — DX scan 2026-10-02

Scope: `libs/components/src/lib/forms/date-time`, `libs/components/src/lib/time-picker`,
`libs/components/src/lib/calendar`, guides `apps/docs/components/{date-time-inputs,calendar,time-picker}.md`,
their stories.

Paths below are relative to `libs/components/src/lib/` unless they start with `apps/`.

| ID    | Sev    | Kind     | Decision | Title                                                                                                           |
| ----- | ------ | -------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| DT-01 | High   | bug      | yes      | `provideDateFormat('yyyy-MM-dd')` from the setup guide silently strips every date-time value's time             |
| DT-02 | High   | dx       | no       | A wire value that does not match `valueFormat` renders as a blank field, with no warning                        |
| DT-03 | Medium | dx       | yes      | `secondStep` is a dead input on five controls and the time picker; the docs describe an effect it does not have |
| DT-04 | Medium | dx       | yes      | Date-only controls default to an instant wire format, which the docs themselves call wrong for a chosen date    |
| DT-05 | Medium | dx       | yes      | `timeRangeOrder` rejects the overnight ranges `et-time-range-input` presents as valid                           |
| DT-06 | Medium | dx       | yes      | No time bounds validator, while the docs tell time-input users to "pair with a schema validator"                |
| DT-07 | Medium | dx       | yes      | `createWeekRangeStrategy` needs a `weekStartsOn` the consumer cannot read, and its type is not exported         |
| DT-08 | Medium | dx       | no       | `durationFormat` silently drops unknown letters: `'HH:mm:ss'` becomes `'mm:ss'`                                 |
| DT-09 | Low    | dx       | no       | The date validators ignore the control's `timeZone`                                                             |
| DT-10 | Low    | dx       | no       | Picker surface template has an untyped `let-` context and no headless composition example                       |
| DT-11 | Low    | dx       | no       | Small docs drift: "three" inputs forward `weekNumbers` (four do), `touch` output undocumented                   |
| DT-12 | Low    | test-gap | no       | No `Masked` story for the time and date-time inputs; styled single/range components have no component spec      |
| DT-13 | Low    | dx       | no       | `displayFormat` / `valueFormat` nullability differs between sibling controls                                    |

## DT-01 `provideDateFormat('yyyy-MM-dd')` from the setup guide silently strips every date-time value's time

- Status: fixed
- Where: `forms/date-time/date-time-formats.ts:9-12` (one `DATE_FORMAT` token),
  `forms/date-time/date-time-input/headless/date-time-input.directive.ts:44`,
  `forms/date-time/date-time-range-input/headless/date-time-range-input.directive.ts:51`,
  `scheduler/scheduler-edit-time-range.component.ts:36`; recommended in `apps/docs/components/setup.md:26`
  and `apps/docs/components/date-time-inputs.md:88`.
- Problem: date-only and date-time controls read the same `DATE_FORMAT` token. The setup guide's
  canonical app config sets `provideDateFormat('yyyy-MM-dd')`, and `date-time-inputs.md` repeats it. Do that,
  and every `et-date-time-input` / `et-date-time-range-input` that does not set its own `valueFormat` writes
  `yyyy-MM-dd`. A ring pick runs `withTimeOfDay(current, time)` and then formats with `yyyy-MM-dd`
  (`date-time-input.directive.ts:257,288-294`), so the time is thrown away and the field snaps back to
  midnight. The same happens to typed `16.07.2026 21:30`. Nothing warns. `apps/docs/cdk/migration.md:907` also
  says cdk's separate `provideDateTimeFormat` was folded into `DATE_FORMAT`, so a migrating app loses the token
  it used to have for exactly this.
- Fix: add a `DATE_TIME_FORMAT` token + `provideDateTimeFormat()` (default
  `yyyy-MM-dd'T'HH:mm:ssxxx`), read by the two date-time controls, `dateTimeBounds`/`dateTimeRangeBounds`/
  `dateRangeOrder` when used on them, and the scheduler. Also add a dev-mode warning on the date-time controls
  when the effective `valueFormat` has no hour token (`H`/`h`/`k`/`K`/`p`). Update setup.md and the migration
  row.
- Breaking: yes (date-time controls stop following `DATE_FORMAT`). Decision: yes (token split vs. warning only).

## DT-02 A wire value that does not match `valueFormat` renders as a blank field, with no warning

- Status: fixed
- Review: ok

- Where: `forms/date-time/date-input/headless/date-input.directive.ts:78-90`,
  `forms/date-time/time-input/headless/time-input.directive.ts:51-67`,
  `forms/date-time/date-time-input/headless/date-time-input.directive.ts:107-123`,
  `forms/date-time/internals/date-range-picker-input.directive.ts:385-396`, strict parse in
  `forms/date-time/internals/date-value.ts:25-44`.
- Problem: the incoming value is parsed strictly against `valueFormat`. On a failure the `Date` is `null`, the
  display is `''`, `parseError` stays `false`, but `hasValue` is `true` (`date-picker-input.directive.ts:47-49`).
  The result is an empty field with a floated label and a visible clear button. Common inputs that do this
  (checked with date-fns):
  - `new Date().toISOString()` → `2026-07-30T00:00:00.000Z`: the `.000` fails the default `ssxxx`
  - `'2026-07-30'` from an API, on a default `et-date-input`
  - `'09:30:00'` on a default `et-time-input` (`HH:mm`)

  Finding out why takes reading the source.

- Fix: in dev mode, warn once per control instance when `value()` is non-null and the parse returns `null`.
  Name the control, the value and the effective `valueFormat`, and say "set `valueFormat` or
  `provideDateFormat()`". Do the same for each range side. Optional and separate: fall back to `parseISO` when
  the strict parse fails, and when the format is the ISO default.
- Breaking: no. Decision: no for the warning (the ISO fallback would be a choice).

## DT-03 `secondStep` is a dead input on five controls and the time picker; the docs describe an effect it does not have

- Status: fixed
- Review: ok (no consumer binds `secondStep`, so no migration)

- Where: `time-picker/headless/time-picker.directive.ts:62,161`; consumers
  `time-picker/headless/time-picker-ring-handle.directive.ts:131-132` (reads only hours and minutes of
  `anchorTime`), `time-picker.directive.ts:194-198` (a ring commit writes `second: 0`). Forwarded by
  `forms/date-time/time-input/time-input.component.ts:74`, `time-range-input.component.ts:81`,
  `date-time-input.component.ts:91`, `date-time-range-input.component.ts:101`. Docs:
  `apps/docs/components/time-picker.md` (Options table and "secondStep still applies to that typing and to
  the 'now' anchor"), `date-time-inputs.md` tables ("Forwarded to the picker").
- Problem: the only read of `secondStep` computes the seconds of `anchorTime`, and every reader of
  `anchorTime` drops the seconds. Typed entry (`internals/time-parse.ts`) never reads it either. So
  `secondStep="15"` changes nothing anywhere. The docs say it rounds typed seconds and the "now" anchor. It is
  left over from the removed column API (`7893079d4`).
- Fix: remove `secondStep` from `TimePickerDirective`, the `et-time-picker` host inputs and the four
  controls, and drop it from both guides. Add a migration that strips the binding. The other option is to make
  it snap typed seconds in `parseTimeText`, but the ring cannot pick seconds, so removing it is simpler.
- Breaking: yes. Decision: yes (remove vs. implement).

## DT-04 Date-only controls default to an instant wire format, which the docs themselves call wrong for a chosen date

- Status: fixed
- Where: `forms/date-time/date-time-formats.ts:9-12` (default `yyyy-MM-dd'T'HH:mm:ssxxx`), used by
  `date-input.directive.ts:31` and `date-range-input.directive.ts:37`; `apps/docs/components/date-time-inputs.md:188-205`.
- Problem: the "Time zones" section says an offset-carrying instant is wrong for "a date someone chose": it
  drifts a day for a reader in another zone. It tells users to store `yyyy-MM-dd`. Yet that is not the default,
  and every example in the guide has to pass `valueFormat="yyyy-MM-dd"`. With the default, a date range's end is
  `…T00:00:00+02:00` on the last day (`date-range-input.directive.ts:107-114` snaps both ends to the start of
  the unit), so a backend `createdAt <= end` filter silently leaves out the whole last day.
- Fix: give the date-only controls (and `dateBounds`/`dateRangeBounds`/`dateRangeOrder` when they read the
  token) a date-only default (`yyyy-MM-dd`, or a precision-derived `yyyy-MM`/`yyyy`). This pairs with the token
  split in DT-01. Then remove the boilerplate `valueFormat` from the docs examples.
- Breaking: yes (default wire value changes). Decision: yes.

## DT-05 `timeRangeOrder` rejects the overnight ranges `et-time-range-input` presents as valid

- Status: fixed (2026-10-06: opt-in `allowOvernight` on `timeRangeOrder`, default unchanged)
- Where: `forms/date-time/date-time-range-validators.ts:78-91,118-119`;
  `time-picker/time-picker.component.ts:171-177,189-201` (duration readout and "ends next day");
  `apps/docs/components/date-time-inputs.md:476-479` (recommends `timeRangeOrder(s.hours)` for this control),
  `apps/docs/components/time-picker.md` (range mode: "22:00 to 06:30 is one arc across midnight").
- Problem: in `et-time-range-input` the ring draws 22:00–06:00 as one arc and the centre reads `8 h` /
  `ends next day`, so the control tells the user the night shift is fine. The validator the guide names for
  this control compares the two `HH:mm` values on one reference day and fails `start > end`. A consumer who
  follows the guide ships a form that rejects every night shift the picker offers.
- Fix: add `allowOvernight?: boolean` to `timeRangeOrder` (when it is `true`, only `start === end` fails, and
  only under `strict`), or invert the default. Document the choice next to the overnight paragraph in both
  guides.
- Breaking: no (with the opt-in option). Decision: yes (option vs. default).

## DT-06 No time bounds validator, while the docs tell time-input users to "pair with a schema validator"

- Status: fixed (2026-10-06: `timeBounds` / `timeRangeBounds`, wrap across midnight reports the nearer bound; labels `timeMin` / `timeMax`)
- Where: `forms/date-time/date-time-range-validators.ts` (ships `dateBounds`, `dateTimeBounds`,
  `dateRangeBounds`, `dateTimeRangeBounds`, `dateRangeOrder`, `timeRangeOrder`; no `timeBounds` /
  `timeRangeBounds`); `apps/docs/components/date-time-inputs.md:417-422`;
  `forms/date-time/time-input/headless/time-input.directive.ts:33-37`.
- Problem: `minTime`/`maxTime` only shape the picker, and the guide says "pair them with a schema validator
  when the form must reject out-of-range times". For dates the lib ships that validator; for times the consumer
  has to write one. That validator has to parse the wire format against the `TIME_FORMAT` token, compare only
  the time of day, and handle a wrapping `min > max` window the way the picker does.
- Fix: add `timeBounds(path, { min, max, valueFormat })` and `timeRangeBounds(...)`. They compare the time of
  day only, wrap when `min > max` (as `timeRingOpenCheck` does), and return `rangeMin`/`rangeMax` errors with
  localized messages. Name them in both guides.
- Breaking: no. Decision: yes (new public API).

## DT-07 `createWeekRangeStrategy` needs a `weekStartsOn` the consumer cannot read, and its type is not exported

- Status: fixed
- Review: ok

- Where: `calendar/headless/calendar-range-strategy.ts:28-31` (required `weekStartsOn`, JSDoc "Pass the
  calendar's `effectiveFirstDayOfWeek()`"), `calendar.directive.ts:536,747` (`select`/`preview` get only
  `(date, current)`), `calendar/headless/internals/calendar-month.ts:3` (`CalendarWeekStartsOn`, not
  re-exported from `calendar/headless/index.ts`), `calendar.directive.ts:148` (public input typed with it).
- Problem: on `et-date-range-input [rangeSelectionStrategy]` the picker calendar is internal, so its
  `effectiveFirstDayOfWeek()` cannot be read. The docs example hardcodes `{ weekStartsOn: 1 }`. Under an en-US
  locale (`DATE_LOCALE` unset) the rows start on Sunday but the bands snap to Monday, so every band starts one
  cell into a row. A consumer who wants to pass a computed week start cannot name its type; the
  `[firstDayOfWeek]="n"` binding with `n: number` fails type-check, and the consumer has to cast to
  `0 | 1 | … | 6`.
- Fix: pass a context as a third argument, `select(date, current, { weekStartsOn, locale })`, from the
  calendar. Make `createWeekRangeStrategy` options optional and default to that context. Export
  `CalendarWeekStartsOn`. Fix the docs example.
- Breaking: no (additive argument). Decision: yes (strategy signature).

## DT-08 `durationFormat` silently drops unknown letters: `'HH:mm:ss'` becomes `'mm:ss'`

- Status: fixed
- Review: ok; test audit: directive warning covered

- Where: `forms/date-time/duration-input/headless/internals/duration-format.ts:23,30-59`.
- Problem: only `h`/`m`/`s`/`S` are tokens, and anything else counts as a separator. Text before the first
  segment is thrown away (`currentSeparator` is reset without a push), so `durationFormat="HH:mm:ss"` (the
  date-fns habit, and how `et-time-input` formats are written) compiles to `mm:ss`. An hour then renders as
  `60:00`, and typed `1:02:03` maps onto the wrong units. There is no dev warning.
- Fix: in dev mode, warn from `DurationInputDirective` when the format holds an ASCII letter other than
  `h`/`m`/`s`/`S`, or text before the first segment. Name the format and suggest `hh:mm:ss`. Treating `H` as an
  alias of `h` is a cheap extra.
- Breaking: no. Decision: no.

## DT-09 The date validators ignore the control's `timeZone`

- Status: fixed
- Review: fixed `timeRangeOrder` no longer accepts `timeZone`, which a time value cannot use

- Where: `forms/date-time/date-time-range-validators.ts:73-74` (`parseSide` has no `timeZone`), `:147,151`
  (messages formatted with `'Pp'` in the runtime zone).
- Problem: a `timeZone="Asia/Tokyo"` date-time control with an offset-less `valueFormat` writes Tokyo wall
  clock (`date-time-inputs.md:230-231`). `dateTimeBounds(s.x, { min: () => new Date() })` reads that string as
  local time, so the bound is off by the zone difference, and the error message names the bound in the
  reader's zone, not the field's.
- Fix: add `timeZone?: string` to the bounds/order options, pass it into `parseDateValue`, and format the
  message with `formatInZone`. Mention it in the time-zone section.
- Breaking: no. Decision: no.

## DT-10 Picker surface template has an untyped `let-` context and no headless composition example

- Status: fixed
- Review: fixed the guard JSDoc (reduced to `@internal`)

- Where: `forms/date-time/picker/date-picker-surface.directive.ts:8-27` (no `ngTemplateContextGuard`, unlike
  `calendar/calendar-header.directive.ts:30-35`), `forms/date-time/picker/date-picker-host.ts:28-31` (context
  `$implicit` typed as the narrow `DatePickerHost`); `apps/docs/components/date-time-inputs.md:732-742`.
- Problem: the "Picker parts" section lists the headless directives but never shows how they fit together
  (`[etDateInput]` + `input[etDateInputField]` + trigger + surface + calendar). Inside a custom surface,
  `let-host` is `any`, and even with a type it would only expose open and close, not
  `date()`/`selectDate()`.
- Fix: add a static `ngTemplateContextGuard` to `DatePickerSurfaceDirective`, and a short headless date-input
  example to the guide that reads the host through `#di="etDateInput"`.
- Breaking: no. Decision: no.

## DT-11 Small docs drift: "three" inputs forward `weekNumbers` (four do), `touch` output undocumented

- Status: fixed
- Review: ok

- Where: `apps/docs/components/calendar.md` (Options, "the three date inputs forward `weekNumbers`"), but
  `weekNumbers` is on `date-input`, `date-range-input`, `date-time-input` and `date-time-range-input`;
  `apps/docs/components/date-time-inputs.md:118-119` lists the change outputs, but every control also emits
  `touch` (`internals/picker-input-base.directive.ts:98`, `date-input.component.ts:61`).
- Fix: change "three date inputs" to "four", and add `touch` to the shared-contract outputs sentence.
- Breaking: no. Decision: no.

## DT-12 No `Masked` story for the time and date-time inputs; styled single/range components have no component spec

- Status: fixed
- Review: ok

- Where: `forms/date-time/time-input/stories/time-input.stories.ts` and
  `date-time-input/stories/date-time-input.stories.ts` (no `Masked`). The guide documents masks for both
  (`HH:mm`, `dd.MM.yyyy HH:mm`); the date, date-range, time-range and date-time-range inputs have one. There is
  no `*.component.spec.ts` for `date-input`, `date-range-input`, `time-input`, `time-range-input` or
  `duration-input`, only for the two date-time ones.
- Problem: the date-time input's mask path (`displayValue` returns `''` for a half-pick while masked,
  `date-time-input.directive.ts:188-190`) has no story to check by eye. The styled-tier wiring (`showClear`
  conditions, preset to `selectPreset`) is only covered where `apps/storybook-e2e/src/date-inputs` happens to
  touch it.
- Fix: add `Masked` stories to both. Add small component specs for the clear-button rule (focused or open,
  `hasValue`, `interactive`) and for preset selection on `et-date-range-input`.
- Breaking: no. Decision: no.

## DT-13 `displayFormat` / `valueFormat` nullability differs between sibling controls

- Status: fixed
- Review: ok; test audit: null display/value formats covered on the time input

- Where: `date-input.directive.ts:42` and `date-range-input.directive.ts:46` (`string | null`), against
  `time-input.directive.ts:31`, `time-range-input.directive.ts:45`, `date-time-input.directive.ts:50` and
  `date-time-range-input.directive.ts:58` (`string`); `internals/picker-input-base.directive.ts:85`
  (`valueFormat: string | undefined`).
- Problem: `[displayFormat]="fmt()"` with `fmt: Signal<string | null>` compiles on the date controls and fails
  on the time ones. `[valueFormat]="null"` fails everywhere, and `undefined` is the only "use the token" value.
  A shared wrapper component around several of these controls has to special-case each one.
- Fix: accept `string | null` for both inputs on every control, with `null` meaning the default.
- Breaking: no (widening). Decision: no.
