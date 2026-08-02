---
'@ethlete/components': minor
'@ethlete/core': minor
---

Carousel & Scrollable: much smoother swiping on a phone - 85% less style recalculation and 88% less
paint with `transition="wipe"`, and no observer work during a scroll. Snapping is native CSS scroll
snap (`ScrollableDirective.suspendSnap()` holds it off while something writes an offset itself), and
the built-in transitions run as composited keyframes. New `transition="custom"` fills
`--et-carousel-slide-progress` without applying an effect, for CSS of your own; new
`--et-carousel-wipe-dim-color`; `signalElementChildren` / `signalElementScrollState` take a
`mutations` option to narrow their observers.
