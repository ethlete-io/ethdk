---
'@ethlete/components': minor
---

Calendar & date inputs: new date foundation for `@ethlete/components`.

- `et-calendar` (`CALENDAR_IMPORTS`): inline month calendar on plain `Date`s with single and range selection, `min`/`max`/`dateFilter`, localized labels and the full ARIA-grid keyboard model; headless `[etCalendar]` / `[etCalendarGrid]` / `[etCalendarCell]` for custom markup.
- `et-date-input` (`DATE_INPUT_IMPORTS`): `string`-valued date field (`valueFormat`, ISO by default) pairing strict typed entry against a locale-aware `displayFormat` with an anchored calendar picker; unparseable text stays visible and raises `parseError` while the value stays `null`.
- `et-date-range-input` (`DATE_RANGE_INPUT_IMPORTS`): one control with two fields sharing a range-mode picker; value `{ start: string | null; end: string | null }`.
- New `provideDateFormat` / `provideTimeFormat` / `provideDateLocale` tokens and a `date-fns` (v4) peer dependency.
