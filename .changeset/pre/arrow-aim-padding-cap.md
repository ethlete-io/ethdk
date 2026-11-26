---
'@ethlete/cli': patch
---

Design arrow aiming: the arrow keeps its padding off a pane corner only as far as floating-ui does (capped at half the pane minus half the arrow), so an arrow on a short pane lands on its anchor centre.
