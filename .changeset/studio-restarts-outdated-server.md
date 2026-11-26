---
'@ethlete/cli': patch
'ethlete-studio': patch
---

Studio restarts the design server it started on the newest CLI commit once no drawing, check or merge runs in it, and offers the restart otherwise, also while `libs/cli` has uncommitted edits; `/__design/queue` reports running writes and quiet time.
