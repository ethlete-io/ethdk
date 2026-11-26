---
'@ethlete/components': patch
'@ethlete/core': minor
---

A gesture the browser takes away mid-drag now emits `dragCancelled` / `resizeCancelled` instead of `dragEnded`. Grid moves and resizes, table column reorder and column resize revert instead of committing a drop the user never made.
