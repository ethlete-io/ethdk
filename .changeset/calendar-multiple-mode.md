---
'@ethlete/components': minor
---

Calendar: `mode="multiple"` selects a set of unrelated dates into its own `multipleValue` model
(`Date[]`, kept ascending). Picking a date again removes it, nothing bands or previews, and the grid
is `aria-multiselectable`. It composes with `precision`. The date inputs have no equivalent - their
value is one wire string.
