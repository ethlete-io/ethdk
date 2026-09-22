---
'@ethlete/components': minor
---

Grid: layout changes are now animated. The container height transitions smoothly as items are added, removed, or reflowed, and items animate on enter and leave instead of snapping. Animations are automatically disabled during the initial render and while the container width is settling (e.g. on resize) so placement never animates unexpectedly, and are fully suppressed for users who prefer reduced motion. Animation duration is tunable via the `--et-grid-anim-duration` custom property.
