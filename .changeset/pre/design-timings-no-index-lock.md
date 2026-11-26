---
'@ethlete/cli': patch
---

`et design` reads the checkout state for its timings without taking git's index lock, so a `git add` or `git commit` running at the same time no longer fails on `index.lock`.
