---
'@ethlete/cli': minor
---

Add `design sketch hold <sketch> --until <text>` and `design sketch release <sketch>`: a held sketch goes back to in progress, leaves the merge queue, and `sketch ready` refuses with the `--until` text until it is released.
