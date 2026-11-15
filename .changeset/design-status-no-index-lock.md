---
'@ethlete/cli': patch
---

`et design` checks for uncommitted parts, shared files and merged sketches without taking git's index lock, so a `git add` or `git commit` running at the same time no longer fails on `index.lock`.
