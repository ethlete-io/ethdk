---
'@ethlete/components': patch
'@ethlete/core': patch
---

Overlay: a color theme provided on the app root component (e.g. `ProvideColorDirective` via `hostDirectives` plus `forceColor()`) now propagates into overlays even when they are opened without a `viewContainerRef`, and updates reactively while the overlay is open.
