---
'@ethlete/cli': patch
---

The visually hidden test of `design check` exempts only a 1x1 px `overflow: hidden` box, so CLIPPED still flags text cut by a box that collapsed to 1 px in one direction.
