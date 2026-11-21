---
'@ethlete/cli': patch
---

`design check` reuses its render and completeness caches when the cli runs from another folder (a working-tree build, a new cli commit, a server snapshot).
