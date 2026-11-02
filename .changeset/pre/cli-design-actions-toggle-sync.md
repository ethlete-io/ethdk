---
'@ethlete/cli': patch
---

`design actions --live` clicks every control that opens an overlay three times and fails when its `aria-pressed` or `aria-expanded` no longer matches whether the overlay is open.
