---
'@ethlete/components': minor
---

New time controls:

- `et-time-picker` (+ headless `[etTimePicker]` column/option directives): inline column-list time picker on `Date` values - columns derive from a date-fns format (12/24h, optional seconds, AM/PM), `minuteStep`/`secondStep`, roving-focus listbox columns with wrapping arrows and type-to-jump.
- `et-time-input` (+ headless `[etTimeInput]`): string-valued form control (`TIME_FORMAT` token, default `HH:mm`) with lenient typed parsing (`930` → 09:30, `9pm`, `9.30`) and an anchored time-picker overlay that stays open across part picks.
