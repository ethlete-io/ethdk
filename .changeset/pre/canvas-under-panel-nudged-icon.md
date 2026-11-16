---
'@ethlete/cli': patch
---

`design check` no longer reports CANVAS-UNDER-PANEL for a control whose small child is nudged with `translate`, such as
the icon of an SDK button: only a moved child that fills the box in one direction makes it a pan viewport.
