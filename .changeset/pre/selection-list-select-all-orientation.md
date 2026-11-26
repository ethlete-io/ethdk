---
'@ethlete/components': minor
---

Selection lists: add `<et-checkbox-group-select-all>`, the prebuilt tri-state select-all row that had
to be hand-rolled until now - a real `role="checkbox"` with `aria-checked="mixed"`, taking its text
from the new shared `selectAll` form label. Also `orientation="horizontal"` on `et-checkbox-group` and
`et-radio-group`, flowing the options in a wrapping row.
