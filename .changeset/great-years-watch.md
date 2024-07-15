---
'@ethlete/cdk': patch
---

Do not error if an overlay is nested inside an other overlay and both are using the `OverlayMainDirective`. The error will still occur if the `OverlayMainDirective` gets used multiple times inside the same overlay.
