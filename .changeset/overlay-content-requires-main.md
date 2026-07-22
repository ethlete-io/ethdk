---
'@ethlete/components': patch
---

Throw `ET1208` when an overlay header, body, or footer is used without an `etOverlayMain` ancestor, so the misuse surfaces immediately instead of silently rendering an unstyled region.
