---
'@ethlete/components': minor
---

Calendar and date inputs: `precision` makes them month or year pickers.

- **`precision` (`'day' | 'month' | 'year'`) on `[etCalendar]`.** The grid holding that unit is the
  finest one the calendar shows, and picking a cell there writes the value rather than drilling
  further in: at `'month'` the 12-month grid *is* the picker. The value is the start of the unit —
  July 2026 is `2026-07-01T00:00`. `startView` can no longer open a grid finer than the precision,
  and the header's wrap-around lands on the selecting grid instead of the day grid.
- **Ranges compare, band, preview and complete at the precision's unit**, so `03/2026 – 06/2026`
  bands four month cells the way a day range bands days, and picking the start month a second time
  completes a one-month range instead of restarting it. One implementation serves all three grids
  now (`createCalendarSelectionReader`), which is also how the day grid keeps behaving exactly as
  before.
- **`precision` on `et-date-input` and `et-date-range-input`**, where it moves the text format with
  it: `displayFormat` defaults to `null` and derives from the precision — the locale's short date at
  day precision (`'P'`, as before), that same pattern with its day removed at month precision
  (`MM.yyyy` for a German locale, `MM/yyyy` for en-US, `yyyy/MM` for Japanese), and `'yyyy'` at year
  precision. Naming a `displayFormat` still wins. Because the derived patterns are fixed-width, a
  month or year field can take the opt-in typing `mask`, which the locale-dependent `'P'` never
  allowed.
- **Typed and picked values normalize the same way.** date-fns fills the units a format leaves out
  from its reference date, so `07/2026` parsed against `MM/yyyy` used to mean *today's* day of July;
  both entry paths now write the unit start.
- `min`/`max`/`dateFilter` keep their day-level meaning throughout: a month is selectable when some
  day inside it is.
- Internally, `displayFormat` is read through the new `effectiveDisplayFormat` on the picker-input
  base — a custom control extending `DatePickerInputDirective` now implements that instead.
