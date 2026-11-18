---
'@ethlete/components': patch
---

`et-select` no longer keeps a static `aria-label` or `aria-labelledby` on its host element, so only the combobox (trigger or search input) carries the accessible name.
