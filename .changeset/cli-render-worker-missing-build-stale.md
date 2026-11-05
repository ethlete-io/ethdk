---
'@ethlete/cli': patch
---

The design render worker restarts once a package build that was missing when it loaded appears, so a render that ran
during an SDK rebuild no longer keeps failing with "missing, run `nx build ...`" until the server restarts.
