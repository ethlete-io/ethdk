---
'@ethlete/components': patch
---

Run effect teardown that never ran: tab panels, tab-bar triggers, notification stack items, PiP cells
and the bracket's journey-highlight listeners returned a cleanup function from `effect()`, which Angular
ignores. A removed tab panel stayed in the group's panel list (shifting later panels' indices), and the
bracket's hover listeners stacked up per re-run and outlived the component.
