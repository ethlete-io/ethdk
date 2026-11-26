---
'@ethlete/timetrack': patch
---

The agent endpoint refuses a day key that names no calendar day, such as `2026-02-30` or `2026-13-01`, for every day operation instead of reading, editing or syncing the day it rolls over into.
