---
'@ethlete/components': patch
---

Form field: a control inside an `@if` that is false at first render no longer throws `ET2200` in dev mode; its accessible name is checked once it appears.
