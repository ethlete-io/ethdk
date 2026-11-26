---
'@ethlete/cli': patch
---

`et design check` now fails with exit 1 and names the browser it looked for when no Chromium is usable on a dev machine. Under `CI` it still prints `RENDER CHECK SKIPPED` and passes.
