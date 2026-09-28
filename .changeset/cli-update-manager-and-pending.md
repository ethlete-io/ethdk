---
'@ethlete/cli': patch
---

`et update` prefers the lockfile over the calling `npx`, runs package managers on Windows, and points every run to `--continue` while an update is unfinished.
