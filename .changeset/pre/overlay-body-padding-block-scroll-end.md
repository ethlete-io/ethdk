---
'@ethlete/components': patch
---

Overlay: `--et-overlay-body-padding-block` now reserves real space at the end of a scrolling body. Its end value used to be swallowed by the scroll container, leaving the last child's border and focus ring clipped against the divider once scrolled to the bottom.
