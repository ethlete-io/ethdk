---
'@ethlete/cli': patch
---

`sketch check` reuses the shots of one run across its ready checks, as `sketch ready` does, so the NO-CHANGED-STATE check no longer shoots every state again.
