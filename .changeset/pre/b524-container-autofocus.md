---
'@ethlete/core': patch
---

`autoFocus: 'container'` now moves focus onto the overlay host, the focusable element that carries the dialog role, instead of the pane, which cannot take focus and left it on the trigger.
