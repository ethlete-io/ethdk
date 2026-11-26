---
'@ethlete/cli': patch
---

`et design` run from a repo checkout prints a WARN on stderr as its first line when the built cli is older than `libs/cli/src`. It names the build time, the newest source time and the rebuild command, and never refuses.
