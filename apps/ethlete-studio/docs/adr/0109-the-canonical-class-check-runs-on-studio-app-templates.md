---
status: accepted
open: none
decided: 2026-11-01
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Surfaces follow the elevation system, not picked names" (Q203-Q206), system lesson, canonical classes
---

# The canonical-class check runs on Studio app templates

The builder wrote `size-[22px]` in app code and no check caught it. The Q220 rule runs on the Tailwind classes in
`apps/ethlete-studio/src` too (lint or `design check`).
