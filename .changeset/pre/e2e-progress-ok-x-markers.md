---
'@ethlete/agent-rules': patch
---

The `e2e-progress` mod counts Playwright list-reporter lines that use `ok`, `x` and `-` instead of the unicode marks, so a run on such a log no longer shows 0 done.
