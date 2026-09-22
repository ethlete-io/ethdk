---
'@ethlete/components': minor
---

Forms: fix bugs and accessibility issues across the form controls, and add a few
opt-in APIs.

- **Fixes:** select-all no longer sticks on "mixed" when a disabled option is
  present; a cascader value set programmatically now shows its breadcrumb (via a
  new optional `resolvePath` on the cascader data source); typed date/time/range
  values no longer leak the current wall-clock time; duration/date/time null the
  value on an unparseable commit; masked inputs no longer break IME composition;
  standalone `input[etInput]` now syncs on keystroke; number steppers mark the
  field touched and can't leak their auto-repeat timer; OTP re-emits `completed`
  when a full code is replaced; color inputs honor `[readonly]`.
- **Accessibility:** multi-select options and the select-all control now use
  `role="checkbox"` (not `option`); a parse error is announced with a real
  message and `aria-describedby`; the date picker panel is a named
  `role="dialog"`; the cascader trigger's `aria-controls` resolves; select
  panels keep only options inside the listbox; the phone country trigger and
  cascader columns gained accessible names/typeahead; a schema-`hidden` field is
  now actually hidden; Caps-Lock detection also samples on focus.
- **New inputs:** `parseErrorMessage` (date/time/date-time/duration/range),
  password `hideLabel`, phone `countryLabel`, date-picker-panel `dialogLabel`.
- **Note:** the checkbox now toggles on `keydown` Space (matching switch and the
  selection options), and the select panel renders its listbox as an inner
  element - restyle if you targeted the panel host as the listbox.
