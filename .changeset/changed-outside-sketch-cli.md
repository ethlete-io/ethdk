---
'@ethlete/cli': minor
---

A sketch merge records each merged part's content hash in the product's `merged.json`. `design check` prints a warning, without failing, for each merged part whose files changed since while no open sketch holds it, and the design server reports it to Studio as `changedOutsideSketch`. Merging a sketch on the part clears it.
