---
'@ethlete/components': patch
---

Menu: the floating arrow no longer affects or overlaps the panel content.

- The overlay arrow is now clipped at the panel edge (it only keeps the outer tip plus the border seam), so the menu no longer adds extra clearance padding on the arrow side - padding is identical regardless of placement.
- `arrowPadding` on `[etMenu]` now defaults to `14` (was `8`) so the arrow can no longer slide into the panel's rounded corners.
