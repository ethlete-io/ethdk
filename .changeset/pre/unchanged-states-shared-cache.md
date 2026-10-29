---
'@ethlete/cli': patch
---

Studio no longer folds a sketch state as unchanged after the sketch's `shared/` folder or the variant's assets or fixtures change: the unchanged-states cache now keys on them too.
