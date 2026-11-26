---
'@ethlete/timetrack': patch
---

Event store: every collected event now carries a dedupe key, so a sample the host repeats after a reload, or a log read from the top again, stores once.
