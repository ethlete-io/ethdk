---
status: accepted
built: f9f9b363c
decided: 2026-10-31
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Surfaces follow the elevation system, not picked names" (Q203-Q206), Q208 (revised)
---

# Overlays in parts use the SDK static overlay renderers

Not through `ng(...)`: the SDK gets an anchored-dialog (popover) renderer in `libs/components/design/`, its pane on
`data-et-auto-surface` by default, and the overlay renderers' `surface` option defaults to the auto surface. Every
popover, dialog or sheet in a part uses these; no hand-built overlay `div`.
