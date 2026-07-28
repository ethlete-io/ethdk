---
'@ethlete/components': patch
---

Unregister removed pieces properly: tab panels, tab-bar triggers, notification stack items and PiP
cells relied on a cleanup function returned from `effect()`, which Angular ignores — a removed tab
panel stayed in the group's panel list (shifting later panels' indices), and a notification or PiP cell
kept a reference to its element after removal.
