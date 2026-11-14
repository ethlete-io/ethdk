---
'@ethlete/cli': patch
---

The design cli reads git through one module: per-file `git show` loops in `design task` and the link history read become one `git cat-file --batch` each.
