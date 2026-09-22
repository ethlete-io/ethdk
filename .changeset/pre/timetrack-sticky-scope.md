---
'@ethlete/timetrack': patch
---

`streamDay()` keeps unrelated windows off a checkout: the sticky context now comes only from a
window title, and only inside the application that set it.
