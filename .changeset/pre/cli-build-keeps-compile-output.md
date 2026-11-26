---
'@ethlete/cli': patch
---

The CLI build copies the compile output into `dist` instead of moving it, and refuses a partial build, so builds running at the same time no longer leave a CLI with missing modules.
