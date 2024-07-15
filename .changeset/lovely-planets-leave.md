---
'@ethlete/cdk': patch
---

Fix CSS class arrays inside overlay configs not getting merged properly and resulting in undefined. This applies to all `class` properties inside the overlay config. E.g. `containerClass`, `paneClass`, `overlayClass`, etc.
