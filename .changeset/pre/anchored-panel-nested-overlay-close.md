---
'@ethlete/components': patch
---

Fix anchored panels (`select`, `cascader`, the date/time pickers) closing when a popover opened from inside them is clicked. A nested overlay (a select body, menu or tooltip) mounts as a sibling pane in the overlay root, not a DOM descendant, so the panel's outside-pointer check treated a click in the child as an outside dismissal and closed itself. The check now resolves the whole nested overlay tree - anchored by each pane's `origin` - so a pointerdown anywhere inside a descendant popover no longer dismisses the panel that opened it.
