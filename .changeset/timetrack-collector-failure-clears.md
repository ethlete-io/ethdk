---
'@ethlete/timetrack': patch
---

A GitLab or calendar failure now clears on the next clean run. It used to clear only in the append step, which a run with no credential never reaches, so a fixed token left the old error on screen.
