---
'@ethlete/core': patch
'@ethlete/components': patch
---

Grid items can now be moved with touch: `[etDragHandle]` sets `touch-action: none` on its host while enabled (the browser was claiming touch pointermoves for scrolling and cancelling the gesture), and read-only grids keep normal touch scrolling.
