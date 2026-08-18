---
'@ethlete/components': patch
---

Table: a `restoreState()` that lands before the `columns` input is populated keeps its column
visibility, which the declared `hidden` used to overwrite.
