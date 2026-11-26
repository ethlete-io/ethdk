---
'@ethlete/core': patch
---

Surface and color directives no longer bundle the `provideColorScheme()` state (media query observer and root class painting) into apps that never call it.
