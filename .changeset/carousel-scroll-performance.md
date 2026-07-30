---
'@ethlete/components': minor
'@ethlete/core': minor
---

Carousel & Scrollable: make swiping smooth on a phone. Measured over eight touch swipes on a
six-times-throttled CPU, the carousel now costs 0 MutationObserver callbacks during a scroll (was
27–771), one programmatic scroll per gesture instead of nine, 85% less style recalculation with
`transition="wipe"` (567ms → 87ms) and 88% less paint (258ms → 31ms), and 70% less with
`transition="dim"` (420ms → 125ms).

- **Scrollable's `snap` is now native CSS scroll snap** rather than a 150ms-debounced JavaScript
  correction. It used to make every swipe stop twice: the gesture ended, the track sat still, and then a
  second ~200ms animation ran to correct it — sometimes by three pixels — and at a looping carousel's
  seam that late correction raced the loop teleport. The browser now folds the snap into the fling, on
  the compositor. `snapOrigin` maps to `scroll-snap-align`, with `'auto'` becoming `proximity` and an
  explicit origin `mandatory`; children marked `etScrollableIgnoreChild` get no snap position.
- **`ScrollableDirective.suspendSnap()`** holds snapping off while something writes a scroll offset
  itself, because `scroll-snap-type: mandatory` overrules a programmatic offset outright and silently
  (`scroll({ left: 950 })` on a 306px-pitch track lands at 918). A cursor drag holds it for the whole
  drag and then glides to the nearest child on release — a mouse button produces no fling for native snap
  to decelerate into, so letting go used to hard-cut the track by up to a slide in one frame. A looping
  carousel holds it across the seam.
- **The carousel's built-in transitions no longer go through `--et-carousel-slide-progress`** where the
  browser has scroll-driven animations. They are keyframes over `opacity`, `scale` and `translate` along
  each slide's own view timeline, which the compositor can run. The property inherits, so animating it
  restyled everything inside every slide on every frame: it measured 263ms of style recalculation against
  3ms for the `calc()` rules reading it. **New `transition="custom"`** fills the property and applies no
  effect of its own — use it where you were relying on `--et-carousel-slide-progress` under `dim` or
  `wipe` to drive CSS of your own. The `js` driver (Firefox, as of this writing) still fills it and looks
  identical.
- **`wipe`'s brightness dip is a composited veil rather than a `filter`.** A filter re-rasterizes
  everything beneath it whenever its value changes — a full slide repaint per frame, and the cause of the
  torn half-drawn tiles on mobile. New `--et-carousel-wipe-dim-color` (default `#000`) sets what it
  darkens with.
- **The loop seam reads its geometry once per settle** instead of twice (each read is a forced layout plus
  an offset per child, on the frame the scrolling stops), and the JS driver is now told to write the new
  progress values synchronously after a teleport rather than a frame later — that stale frame put every
  slide's content a whole track from the box clipping it, which `wipe` drew as a blank slide.
- **The scrollable's subtree MutationObservers are narrowed.** `signalElementChildren` and
  `signalElementScrollState` watched `{ childList, subtree, attributes }` on the scroll container, so
  every inline style written anywhere inside it — a carousel's JS transition driver writes one per slide
  per animation frame — ran a change detection tick and a forced `scrollWidth` read. Both now take a
  `mutations` option; the scrollable passes narrow configs. `useCursorDragScroll` takes a `canScroll`
  signal so it stops putting a second MutationObserver and ResizeObserver on an element the scrollable
  already watches.
- The scrollable's `et-scrollable--has-partial-items` class is only computed when edge masks are rendered.
  It flips as often as a scroll crosses an item boundary, and restyled the whole track for a selector
  nothing matched.
- **Fixed: `<et-carousel>` autoplayed by default.** `autoplay` was an alias of `etCarouselAutoplay`'s
  `enabled`, which defaults to `true` because putting that directive on an element is the opt-in — but the
  component always carries it, so every carousel that didn't say `[autoplay]="false"` was playing (and
  repainting a countdown ring), against what both the component and the directive documented. `autoplay` is
  now the component's own input, defaulting to `false`. If you have a carousel you *wanted* autoplaying and
  never said so, add `autoplay`. On the headless directive, read the new `isEnabled()` for what is in
  effect; `enabled` keeps its `true` default.
- **The autoplay countdown ring is composited.** It closed by animating the angle of a `conic-gradient`
  through a registered custom property — a gradient has to be re-rasterized for every value, and animating a
  registered property recalculates style every frame whether the value moved or not. Idle, that cost ~1120
  paints and ~510 style recalculations over nine seconds. It now rotates two half-discs, one per half of the
  circle: ~139 and ~89 for the same nine seconds, which is what the page costs with no ring at all. Visually
  identical. The ring renders two extra spans per dot while autoplay is on, and
  `--_et-carousel-progress` is gone.
