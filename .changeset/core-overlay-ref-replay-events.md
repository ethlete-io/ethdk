---
'@ethlete/core': patch
---

The overlay ref's lifecycle observables now replay their event, so `mount(...).beforeOpened()` or a subscribe after `close()` still emits.
