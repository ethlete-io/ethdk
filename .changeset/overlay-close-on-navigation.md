---
'@ethlete/components': major
---

Breaking (behavior): overlays now close with the source `'navigation'` when an Angular Router navigation to another path starts. Set `closeOnNavigation: false` to keep one open. An opener's `afterClosed` now also runs for a close that started before its host was destroyed.
