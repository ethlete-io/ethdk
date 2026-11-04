---
status: accepted
open: none
decided: 2026-11-01
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Surfaces follow the elevation system, not picked names" (Q203-Q206), Studio app code quality
---

# Studio app code: zero lint warnings, no inline SVGs, no inline components

After the implementation phase: 0 warnings in `ethlete-studio`, then a new warning fails lint; icons and logos come
from one place (foundations assets or an icon component); nothing inline is left after ADR 0105's extraction.
