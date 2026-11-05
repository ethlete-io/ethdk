---
'@ethlete/cli': patch
---

`et design` commands that draw now rebuild a stale `dist/libs/<lib>` first, and refuse with the build command when the rebuild fails, instead of drawing from the old build.
