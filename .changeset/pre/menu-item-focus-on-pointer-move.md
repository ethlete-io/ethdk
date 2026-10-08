---
'@ethlete/components': patch
---

Fix a menu item taking focus from keyboard navigation when the list scrolls under a resting pointer. The item now takes focus on a pointer move, not on `pointerenter`.
