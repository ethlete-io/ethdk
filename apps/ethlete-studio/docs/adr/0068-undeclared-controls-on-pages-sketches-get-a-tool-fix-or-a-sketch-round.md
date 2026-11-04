---
status: accepted
open: none
decided: 2026-10-31
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Surfaces follow the elevation system, not picked names" (Q203-Q206), Q219
---

# Undeclared controls on pages/sketches get a tool fix or a sketch round

`studio-menu`, the round picker `et-form-field` and `pin` should belong to the embedded parts under the
control-ownership rule. The builder finds the cause: a tool gap gets a tool fix; a page that draws the controls
itself gets a sketch round that embeds the real parts.
