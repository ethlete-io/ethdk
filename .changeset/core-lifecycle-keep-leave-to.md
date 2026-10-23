---
'@ethlete/core': patch
---

Keep `et-animation-leave-to` on an `AnimatedLifecycleDirective` host after its leave finishes, until the next `enter()`. An element removed a frame after its leave no longer flashes back to full opacity first.
