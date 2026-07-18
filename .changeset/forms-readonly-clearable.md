---
'@ethlete/components': minor
---

Forms consistency: `readonly` and one-click clearing across more controls.

- Checkbox, switch and the three selection-list groups now honor `readonly` (e.g. from a `readonly(...)` schema): normal look, still focusable (`aria-readonly`), toggling/selecting blocked — arrows in a readonly radio group move focus without selecting.
- Date, time, date-time, duration and phone inputs render a clear (×) button while the focused field holds a value (`clearable`, default on; label via `clearLabel`), backed by a public `clearValue()` on their headless directives.
