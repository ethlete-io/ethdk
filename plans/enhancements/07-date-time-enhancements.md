# 07 - Date & time enhancements

Additions to the date-time family. §4–5 (view drilling + partial precision)
were added 2026-07-30 after reviewing Material's datepicker
(https://material.angular.dev/components/datepicker/overview) - §6 records the
smaller Material-inspired items. (Event markers moved from backlog into §6's
`dateClass` hook - a class hook covers most marker use cases cheaply.)

**2026-07-30, later: the whole backlog was pulled into scope and built** - see §8.
Nothing in the original "NOT in scope" list is outstanding.

## 1. Date-range presets / quick-picks

No preset concept exists anywhere in `date-time/` (grepped: no
`preset`/`shortcut`/`quickPick`). "Today", "Last 7 days", "This month" is one
of the most common range-picker asks and there's currently no extension point
into the picker panel.

- `presets` input on the date-range input / its picker:
  `{ label: string; range: () => [Date, Date] }[]` (factory, so "today"-
  relative values are computed at click time). No built-in preset list - labels
  are consumer-supplied strings (i18n stays the consumer's).
- Rendering: a preset rail in the picker panel (inline-start column on
  desktop, horizontally scrollable chip row in the mobile bottom sheet -
  compose `et-chip` / scrollable). Clicking applies the range, keeps the
  panel open (so the user can adjust) - match the "click sets both ends"
  semantics of the existing range flow; add `applyAndClose?: boolean` if
  product wants one-tap-done.
- Active-preset detection: highlight a preset when the current value equals
  its computed range (day-granularity comparison).
- Headless tier: expose preset state/apply on the headless directive so custom
  panels can build their own rail.

## 2. "Today" / "Now" jump shortcut

- Calendar: optional footer action ("Today") that moves `activeMonth` to the
  current month and focuses today's cell (does not select it - selection stays
  an explicit user action). Input-gated (`showTodayButton` or a projected
  footer slot - prefer a slot + a prebuilt button component, consistent with
  the lib's composition style).
- Time picker: "Now" equivalent that scrolls/focuses current time.
- Labels via the calendar/date-time label token (see `03-i18n-consolidation.md`).

## 3. Time-picker min/max/filter (parity with calendar)

Calendar has `min`/`max`/`dateFilter`; the time picker has neither bounds nor
filter (`time-picker.directive.ts` - only `minuteStep`/`secondStep`). Booking
UIs need "opening hours only".

- Add `min`/`max` (`Date` or time-of-day; decide one - recommend accepting a
  `Date` and reading its time-of-day, matching how values already work) and
  `timeFilter?: (date: Date) => boolean` on the headless time-picker.
- Disabled option cells: same disabled semantics/styles as calendar's disabled
  dates (aria-disabled, skipped by typing-jump, not focusable-selectable).
  Column interaction: an hour is disabled when no selectable minute exists
  within it - compute per-column availability, don't just disable leaf
  minutes.
- The combined date-time input should thread the selected _date_ into the
  time filter (opening hours can differ per weekday):
  `timeFilter(candidateDateTime)` receives the full timestamp.
- Also wire the same bounds into the date-time input's time pane so typed
  entry clamps/validates consistently (typed values outside bounds → the
  existing invalid-value behavior of the masked inputs).

## 4. Calendar view modes: month / year / multi-year drilling

The calendar renders exactly one view today: a day grid with prev/next month
buttons. Material's model is the reference: three stacked views -
**month** (day grid), **year** (12-month grid), **multi-year** (24-year grid) -
with the header label as a zoom-out button (day grid → year view → multi-year
view) and selection zooming back in (pick year → year view; pick month → day
grid).

- Headless: a `view` signal (`'month' | 'year' | 'multiYear'`) on the calendar
  directive plus `startView` input (default `'month'`). Month/year cell
  models follow the existing `CalendarCell` shape (selected/today/disabled
  flags) so the default component's cell styling carries over; `min`/`max`/
  `dateFilter` disable month/year cells when **no** selectable day exists
  inside them (compute availability, mirroring §3's hour/minute rule).
- Header label becomes a button (`aria-live` label update on view change,
  proper `aria-label` via the calendar labels token).
- Keyboard per view (Material's model): arrows move by cell, Home/End to
  bounds, PageUp/Down = next unit (month / year / 24-year page), Alt+PageUp/
  Down = bigger jump. The existing day-grid roving-tabindex machinery is the
  base - generalize, don't fork.
- Outputs: `yearSelected` / `monthSelected` (normalized `Date`) so consumers
  can hook selection at coarser levels even in day-precision mode.
- The month-slide transition system (`navigationDirection`/`visibleMonthKey`)
  needs a "zoom" transition variant between views - keep it subtle,
  reduced-motion-safe.

## 5. Partial-precision values (month picker, year picker, …)

Material fakes this with `startView` + closing in `monthSelected`; we can do
it first-class since we own the input masks too.

- `precision` input on the calendar + date input (`'day'` (default) |
  `'month'` | `'year'`): the calendar's deepest view is the precision level
  (month precision → selection happens in the year view's month grid; year
  precision → multi-year grid), and the value normalizes to the unit start
  (e.g. `2026-07-01T00:00`).
- The masked date input derives its mask/format from precision via the
  existing `DATE_LOCALE`/format infrastructure (`MM/YYYY`, `YYYY`) -
  parsing, placeholder, and validation adjust together. The range input gets
  the same treatment (month ranges like "07/2025 – 03/2026" are a real
  reporting-filter ask).
- Equality/comparison helpers (active preset detection, range banding,
  min/max) must compare at the precision's granularity.
- Out of scope: sub-unit standalone formats ("only day-of-month", "only
  month-without-year"). No full-date value can round-trip them; if a real use
  case appears, that's a bespoke masked input, not a calendar precision.

## 6. Material-inspired extras (small, do alongside §4–5)

- **`dateClass` hook**: `(date: Date, view) => string | string[] | null` on
  the calendar - per-date styling classes (busy/available/holiday markers).
  Covers most of the "event markers" backlog item; full marker slots stay
  backlog. Document that returned classes are consumer CSS (unlayered, so
  they win over component styles per the layering setup).
- **`startAt` input**: open the calendar at a given month/year without a
  value (today: derived from value/current date only).
- **Confirmation actions slot**: optional footer with cancel/apply for the
  picker overlay - selection becomes pending until applied (Material notes
  this is preferred for assistive tech; also the natural place for §1's
  `applyAndClose` and §2's Today button - design the footer slot once).
- **Alt+ArrowDown** opens the picker from the input (Escape already closes
  the overlay - verify).
- Was recorded as backlog, not planned: comparison ranges (`comparisonStart/End`
  banding), pluggable range selection strategy (e.g. snap-to-week), custom
  calendar header component. All three are built - see §8.

## 7. Documented rough edge to fix if cheap (investigate, don't force)

Range per-field errors don't reach the field's single error area (docs call
this out). During implementation, check whether the shell's error resolver can
merge child-field errors for the range input; if it needs schema-level work in
signal-forms, leave documented as-is and note the finding.

## Verification & shipping

Stories: presets desktop + bottom-sheet, today/now shortcuts, time bounds with
per-day filter (weekend hours differ), combined date-time filtering, view
drilling (header zoom-out, keyboard per view), month picker + month-range
picker, `dateClass` markers, confirmation actions. Docs:
`date-time-inputs.md` + `calendar.md` + `time-picker.md`. Changeset:
`@ethlete/components` (minor).

## 8. The former backlog (built 2026-07-30)

Everything the plan had deferred, in the order it shipped. Each is its own commit
with a changeset and docs.

- **Header and transition polish** (`120ff4a5e`) - the header label transitions with
  the grid it names, the caret is pinned so a longer label cannot move it, it has a
  press state, grids crossfade through one shared grid area, and a picker panel
  reserves the day grid's six-row worst case so neither paging nor drilling resizes
  it. The month/year grids use the day grid's row height, centred in that box.
- **Week numbers** (`cbd68e028`) - `weekNumbers` on `et-calendar` plus
  `calendar.weekNumbers()` on the headless tier, localized (not always ISO), a
  `rowheader` per row, `--et-calendar-week-number-size`, forwarded by the three date
  inputs. New `CALENDAR_LABELS.week`.
- **`mode="multiple"`** (`8692c2c8d`) - a `Date[]` model of its own, ascending, where
  a second pick unpicks; `aria-multiselectable`; toggles whole months at month
  precision. No date-input equivalent (one wire string).
- **Comparison ranges** (`06a6ba288`) - `comparisonStart`/`comparisonEnd` band a
  compared period as a bar _under_ the cells, so an overlap with the selection reads
  as both. New `'single'` band position. Also fixed the week-number column declaring
  a zero-width track in every calendar without one, which collapsed the first cell of
  each row.
- **Range-selection strategies** (`c41beec18`) - `rangeSelectionStrategy`, with
  `createWeekRangeStrategy` and `createFixedLengthRangeStrategy` built in and the
  default rule expressed as one. `CalendarRange` moved to
  `headless/calendar-range-strategy.ts` (same public path).
- **Replaceable header** (`739e93a9b`) - `ng-template etCalendarHeader` renders instead
  of the component's own header, receiving the headless directive, which `et-calendar`
  also exposes as `headless`. Also stopped the NG0956 dev warning the keyed one-item
  `@for` caused on every navigation (now alternating `@if` branches via
  `transitionParity`).
- **Time zones** (`a08e29db4`, docs only) - the contract written down: every `Date` is
  local wall-clock, `valueFormat="yyyy-MM-dd"` is the fix for calendar dates, and
  rendering a _foreign_ zone is out of scope with the reason (zoned arithmetic through
  calendar + time picker + all four inputs, a new dependency, different value
  semantics). **Open decision** if that is ever wanted.
- **Multi-month view** (`8ff506229`) - `monthsShown` renders consecutive months side by
  side with one keyboard scope, one selection and a band through the seam; steps by a
  single month; spilled-in days left to the month that owns them; coarse grids stay
  single, centred in the reserved width. Not forwarded by the date inputs (their picker
  has to fit a phone).
