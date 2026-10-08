---
'@ethlete/core': major
'@ethlete/components': patch
'@ethlete/cdk': patch
---

`AnimatedLifecycleDirective` gains a read-only `state` signal, and `state$` is now a read-only observable; read `state()` instead of `state$.value`.
