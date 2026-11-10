---
'@ethlete/cli': patch
---

Design calls that run at once in one checkout no longer race on `dist/libs`: a call waits for another call's lib build, and a rebuild waits until no call still renders from the old build.
