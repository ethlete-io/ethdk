# hunt-date-time — bug hunt 2026-10-10

Scope: `libs/components/src/lib/forms/date-time` (incl. the date range input), `time-picker`, `calendar`.
Checked against `date-time.md` (DT-01..DT-13) and `git log -40` of the three paths; none of these is a repeat.

Paths below are relative to `libs/components/src/lib/` unless they start with `apps/`.

| ID    | Sev    | Kind | Decision | Title                                                                                                         |
| ----- | ------ | ---- | -------- | ------------------------------------------------------------------------------------------------------------- |
| HD-01 | High   | bug  | no       | A two-digit year typed into the default date format commits year 0026, with no parse error                    |
| HD-02 | Medium | bug  | no       | On the runtime's spring-forward day an empty time ring commits 03:30 for a tap on 02:30                       |
| HD-03 | Medium | bug  | no       | With a zone, the date picker offers a day `dateBounds` rejects, also for the default `yyyy-MM-dd`             |
| HD-04 | Medium | bug  | no       | Without a date locale, "This week"/"Last week" presets run Sunday-Saturday while the calendar is Monday-first |
| HD-05 | Low    | bug  | no       | Without a date locale, week numbers mix Monday rows with the en-US first-week rule                            |

## HD-01 A two-digit year typed into the default date format commits year 0026, with no parse error

Status: fixed - `parseDateValue` rejects a year under 1000 when the format's year token is not `yy` (covers date, date-range, date-time and the lenient `P` pass).

- Where: `forms/date-time/date-input/headless/date-input.directive.ts:156-162` (typed parse against
  `effectiveDisplayFormat`), default format `'P'` from `forms/date-time/internals/precision-format.ts:6-8`,
  strict parse `forms/date-time/internals/date-value.ts:25-44`. Same path in
  `date-range-input/headless/date-range-input.directive.ts:179-187` and the lenient `'P'` pass of
  `internals/date-time-parse.ts:32,50` (date-time inputs).
- Problem: `'P'` is `dd.MM.y` (de) / `MM/dd/yyyy` (en-US). date-fns' year parser takes 1-4 digits for `y`/`yyyy`
  and only normalizes two digits for the `yy` token. Checked with date-fns in `TZ=Europe/Berlin`:
  `parse('01.02.26', 'P', ref, { locale: de })` → `0026-02-01`, `'1.2.26'` → `0026-02-01`,
  `'01.02.202'` → `0202-02-01`. So typing `1.2.26` in an `et-date-input` (mask is opt-in, so unmasked by default)
  commits the wire value `0026-02-01`, displays `01.02.26`, and raises no `parseError`. A birthday form saves
  year 26 AD. No spec covers a short year (`internals/date-time-edge-cases.spec.ts` only has 4-digit years).
- Fix: in `parseDateValue` (or in the typed-commit parsers only), reject a parse whose year token matched fewer
  than 4 digits when the format has `y`/`yyyy` - simplest: when the format's year token is not `yy`, require
  the parsed year >= 1000, else return `null` so `parseError` shows. Alternatively map 2-digit input with
  date-fns' `yy` rule (retry with the year token replaced by `yy`). Add specs for `1.2.26` (de) and `2/1/26`
  (en-US) on the date, date-range and date-time inputs.
- Breaking: no. Decision: no (reject is the safe default; a 2-digit mapping could be a follow-up).

## HD-02 On the runtime's spring-forward day an empty time ring commits 03:30 for a tap on 02:30

Status: fixed - an empty ring builds on `clockSafeDay(now)` (moved from `timeReferenceDay` into time-picker internals).

- Where: `time-picker/headless/time-picker.directive.ts:200-207` (`setTimeOfDay(current ?? startOfDay(this.now()), …)`),
  `time-picker/headless/internals/time-availability.ts:20-21`.
- Problem: the time inputs read values on `timeReferenceDay()` (`forms/date-time/internals/time-parse.ts:9-13`),
  a day without a clock change, precisely so 02:30 survives the DST day. The ring only gets that day from an
  existing value. With an empty value it builds the time on today: in Europe/Berlin on 2026-03-29,
  `setHours(startOfDay(now), 2)` jumps to 03:00 and the commit is 03:30 (checked with date-fns:
  `minute of day 210`). Input: `et-time-input` with no value, open the picker on 2026-03-29, tap 02:30 → value
  `'03:30'`, the handle jumps. Same for an empty end of `et-time-range-input` and for the held time of an empty
  `et-date-time-input` (the held 03:30 is then merged onto whatever day is picked, e.g. April 2). The existing
  DST specs (`time-input.directive.spec.ts:253-298`, `time-range-input.directive.spec.ts:230`) pick only after
  setting `'01:30'`, so the empty-ring path is untested. The 02:xx stops are also drawn as open.
- Fix: let `TimePickerDirective` take the base day from the host (e.g. an input `referenceDay`, set to
  `timeReferenceDay()` by the time inputs), or use `timeReferenceDay()` itself when the value is empty and no
  `day`/`rangeDays` is given. Add a spec: empty `et-time-input` on 2026-03-29, tap 02:30 → `'02:30'`.
- Breaking: no. Decision: no.

## HD-03 With a zone, the date picker offers a day `dateBounds` rejects, also for the default `yyyy-MM-dd`

Status: fixed - option (b): `dateBounds`/`dateRangeBounds` follow `provideDateTimeZone()` (or a `timeZone` option) and compare on the zone calendar; docs paragraph rewritten.

- Where: `forms/date-time/date-input/headless/date-input.directive.ts:126-129` (`pickerMinDate`/`pickerMaxDate` =
  `toZoneCalendar(minDate, zone)` regardless of `valueFormat`), `forms/date-time/date-time-range-validators.ts:291-301`
  (`dateBounds`: no `timeZone`, `startOfDay` in the runtime), same pair in `date-range-input.directive.ts:120-124` and
  `dateRangeBounds` (`:254-264`). Docs: `apps/docs/components/date-time-inputs.md:316-326`.
- Problem: the docs say that with a date-only format "the zone changes nothing", but the picker bounds still move
  to the zone's calendar while the validator stays on the runtime's. Input: runtime Europe/Berlin,
  `provideDateTimeZone('America/New_York')`, default `yyyy-MM-dd`, `[minDate]="now"` plus
  `dateBounds(s.day, { min: () => new Date() })`, at 2026-10-10 01:30 Berlin (= 2026-10-09 19:30 New York). The
  picker's min day is Oct 9 (`zonedProxy`), picking it writes `'2026-10-09'`, and `dateBounds` compares it with
  `startOfDay(Oct 10 01:30 local)` = Oct 10 → `rangeMin` "Choose dates on or after 10/10/2026". The reader picks
  an enabled day and gets an error. The reverse zone pair lets a typed day the picker disables pass.
- Fix: either (a) read `minDate`/`maxDate` on the zone calendar only when `valueFormat` has a time or offset, so a
  date-only control is truly zone-free as documented, or (b) give `dateBounds`/`dateRangeBounds` the control's
  zone (follow `provideDateTimeZone()` like the date-time validators) and compare `zonedProxy(min)`'s day. (b)
  matches what the picker shows; then fix the docs paragraph. Add a spec with the two zones above.
- Breaking: no ((a) changes picker bounds for zoned date-only controls). Decision: no, unless picking (a) vs (b)
  needs the user.

## HD-04 Without a date locale, "This week"/"Last week" presets run Sunday-Saturday while the calendar is Monday-first

Status: fixed - `DateRangePresetContext.weekStartsOn` from `firstDayOfWeek ?? locale ?? 1`; spec and docs updated.

- Where: `forms/date-time/date-range-presets.ts:67` (`weekOptions` → `undefined` for a `null` locale, so date-fns'
  en-US Sunday), used at `:107-121`; the calendar's default `calendar/headless/calendar.directive.ts:230-232`
  (`firstDayOfWeek ?? locale?.options?.weekStartsOn ?? 1`). The preset context (`internals/date-range-presets-state.ts:20-21`)
  passes only the locale, never the input's `firstDayOfWeek`.
- Problem: `DATE_LOCALE` defaults to `null` (`date-time-formats.ts:36-39`). On Sat 2026-10-10 `thisWeekPreset()`
  writes Sun Oct 4 – Sat Oct 10 while the picker rows run Mon–Sun, so the band starts on the last cell of the
  previous row and stops before the row's end. The spec cements it (`date-range-presets.spec.ts:54`, Sunday
  for no locale). The same happens with any locale when the consumer sets `firstDayOfWeek` on the input: the
  rows and `createWeekRangeStrategy` follow it, the presets do not. The docs (`date-time-inputs.md:433`) say
  "starting on the locale's first day", which a reader with no locale cannot predict.
- Fix: add `weekStartsOn` to `DateRangePresetContext` and fill it from the input's effective first day (the same
  `firstDayOfWeek ?? locale ?? 1` rule the calendar uses; expose it on the range directives), and use it in
  `weekOptions`. Update the spec and the docs row.
- Breaking: yes for consumers relying on Sunday weeks without a locale (minor). Decision: no.

## HD-05 Without a date locale, week numbers mix Monday rows with the en-US first-week rule

Status: fixed - `firstWeekContainsDate` defaults to 4 without a locale.

- Where: `calendar/headless/calendar.directive.ts:377-387` (`firstWeekContainsDate = locale?.options?.firstWeekContainsDate ?? 1`
  with `weekStartsOn` defaulting to 1).
- Problem: with `DATE_LOCALE` `null`, rows start on Monday but the first week is the one containing Jan 1 (en-US
  rule). Row Mon 2026-12-28 – Sun 2027-01-03 is labelled week 1 (checked: `getWeek(2026-12-28, {weekStartsOn:1,
firstWeekContainsDate:1})` = 1, ISO = 53), and the next row 2, where ISO and every Monday-first locale say 53
  and 1. No locale uses this pair, so the column is wrong for everyone without `provideDateLocale`.
- Fix: when the locale is `null` (the Monday fallback applies), default `firstWeekContainsDate` to 4, so the
  fallback is ISO 8601 throughout. Spec: no locale, December 2026 → last row 53.
- Breaking: no. Decision: no.
