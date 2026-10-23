---
'@ethlete/cli': minor
---

A design drawing's `setup` can now be an array of functions, run in order, so `flow.on(rules)` combines with the drawing's own setup. The first function that throws stops the rest.
