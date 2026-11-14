---
'ethlete-studio': patch
---

Studio no longer reads every running design server as stale: it compares only the stamp's version and build, and judges a server that answered no stamp yet again on the next check.
