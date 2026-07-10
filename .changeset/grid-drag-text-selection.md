---
'@ethlete/components': patch
---

Grid: prevent text selection inside a grid item when dragging it in
non-readonly mode. `user-select` is now disabled on the item content whenever the
grid is editable, instead of only after a drag has committed — so the initial
pointer movement before the drag threshold no longer selects the item's text.
