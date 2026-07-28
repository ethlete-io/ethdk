---
'@ethlete/core': patch
---

`useCursorDragScroll` no longer starts a drag on a secondary click, and ends one when a context menu opens —
previously a right-click left it latched on, so every later mouse move scrolled the container.
