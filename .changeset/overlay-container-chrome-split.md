---
'@ethlete/components': patch
---

Overlay: split the arrow and header/body/footer chrome CSS into styles-only components mounted only when a strategy or `OverlayMainDirective` actually uses them, and gated the drag-handle node the same way.
