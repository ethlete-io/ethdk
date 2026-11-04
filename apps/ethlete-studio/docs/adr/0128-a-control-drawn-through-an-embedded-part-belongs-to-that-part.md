---
status: accepted
open: none
decided: 2026-10-30
source: plans/ethlete-studio/design-system-actions/render-checks.md, 4.47, control ownership
---

# A control drawn through an embedded part belongs to that part

Every rendered part root carries `data-et-part`, and discovery gives each control inside it to that part, which must
pass `design complete` itself. A page declares only its own controls; restyling an owned control fails as
`CONTROL-OVERRIDDEN`. Merged parts change only through sketches after this.
