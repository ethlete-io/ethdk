---
'@ethlete/core': patch
---

`createCanAnimateSignal` cancels its pending frame when its host is destroyed, and `matchesReducedMotion` returns `false` in an environment without `matchMedia` instead of throwing.
