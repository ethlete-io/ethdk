---
'@ethlete/cli': patch
---

A process spawned while a design command holds the product lock, such as the commit hook of `design sketch merge`, now runs under that lock instead of waiting 10 s and failing.
