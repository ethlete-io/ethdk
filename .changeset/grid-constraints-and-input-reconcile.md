---
'@ethlete/components': patch
---

Grid: a `minColSpan` wider than the breakpoint's column count now degrades to full width instead of overflowing, edges that cannot resize grow no handles, clearing `initialItems` clears the grid, and reconciling that input no longer emits `layoutChange`.
