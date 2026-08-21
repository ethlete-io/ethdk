---
'@ethlete/core': patch
---

An overlay opened without an `injector` or a `viewContainerRef` now reaches its own `providers` from
the content component, instead of resolving them against the opener's environment injector.
