---
'@ethlete/core': patch
---

- `etAnimatedLifecycle` no longer ends an enter or leave before its animation started, which destroyed a routed overlay page without playing its exit animation.
- Adds `AnimatableDirective.getRunningAnimations()`.
