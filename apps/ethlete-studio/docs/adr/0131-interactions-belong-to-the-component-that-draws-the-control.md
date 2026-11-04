---
status: accepted
built: 0788954d7
decided: 2026-10-30
source: plans/ethlete-studio/design-system-actions/render-checks.md, 4.47
---

# Interactions belong to the component that draws the control

Tom: hover and focus states of an accordion do not belong in a page design. A page control names the part that draws
it (`part: 'components/disclosure'`); hover and focus-visible come from that part, and the page draws only what
depends on its placement. A page control without `part` fails (`CONTROL-PART-MISSING`, `CONTROL-PART-INCOMPLETE`).
