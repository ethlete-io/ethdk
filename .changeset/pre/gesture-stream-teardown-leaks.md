---
'@ethlete/components': patch
---

Fix three teardown leaks: the table reorder auto-scroll loop, the scrollable
navigation scroll listener and the PiP window snap timers now stop on destroy.
