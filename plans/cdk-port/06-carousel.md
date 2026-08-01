# 06 - Carousel

**Status: shipped 2026-07-28 (phases 1 and 2).** `libs/components/src/lib/carousel/` - headless
`etCarousel` (active slide from the scrollable's intersections, `next`/`previous`/`goTo`, seamless
`loop`, the slide-progress transition system, region semantics), `etCarouselSlide` (the typed slide
template), `etCarouselItem` (slide semantics, clone marking, per-slide duration), opt-in
`etCarouselAutoplay`, the three control directives, default `et-carousel`,
`CarouselTransitionStylesComponent`, `CAROUSEL_IMPORTS`, `provideCarouselLabels`, error codes ET38xx,
stories, spec, docs page, changeset. Adds the `et-play`/`et-pause` icons and `booleanAttribute`
transforms on the scrollable's boolean inputs.

Phase 1 deviations and decisions beyond the plan below:

- **Where `etCarousel` goes.** It needs the scrollable, but the slides and controls need _it_ - and DI
  only looks upwards. So it takes its track from its own element, from its content, or from
  `<et-carousel>` handing it over, and the recommended headless shape is a wrapper around both the
  scrollable and the controls. (First attempt put it on the inner scrollable inside the Tier 3 template;
  projected slides and the controls then resolved `null`, which the Storybook run caught.)
- **`goTo` scrolls with `origin: 'start'`.** The scrollable's default `'nearest'` deliberately does
  nothing for an element merely _adjacent_ to the viewport edge - which is exactly where the next slide
  sits at one-slide-per-view, so `next()` never moved.
- **Autoplay restarts the slide's full duration on resume** rather than continuing a partial one, so the
  progress ring (a CSS animation, rendered only while the countdown runs) and the timer are one clock and
  cannot drift. Reduced motion refuses to play at all; the WCAG 2.2.2 pause control is enforced in dev.
- **Slide transitions are position-driven, not flag-driven.** `transition="dim"` ran each slide's keyframes
  on its own `view()` timeline, so the effect tracked a drag instead of stepping on an "active" flag, and
  browsers without scroll-driven animations got the plain scroll. (Phase 2 kept the idea and moved the
  keyframes down a level: they now animate a single progress _property_ that a JS driver can fill just as
  well, so the effects no longer degrade away.)
- **Off-screen slides are not hidden.** cdk stacked its slides and had to `inert` them; a scrolling
  carousel must leave them reachable by scroll and by Tab. (Phase 2's loop _clones_ are the one exception -
  same slide twice, so `aria-hidden` + `inert`.)

## Phase 2 - a real carousel (**shipped 2026-07-28**)

Phase 1 shipped the composition, and the review of it is fair: it was a scrollable with chrome. Both
missing pieces are now in: template-only slides, seamless looping over rendered clones, and the
slide-progress transition system with both drivers plus `dim` and `wipe`. The design below is what was
built; deviations and the things verification caught:

- **The slides array binds to the `<ng-template>`, not to `<et-carousel>`** -
  `<ng-template [etCarouselSlide]="teams()" let-team>`. Angular can only infer a template's context type
  from an input bound on the template itself (the repo's own convention - see `table-templates.ts`), and
  `strictTemplates` is on, so `[slides]` on the component plus a bare `etCarouselSlide` would have left
  `let-slide` as `unknown` in every consumer template. One binding, no duplication, `T` inferred. The
  per-slide autoplay duration went to the same place for the same reason: `autoplayTimeFor` on the
  template has the slide type, so the callback's argument infers instead of needing a cast.
- **The carousel owns `cloneCount`, and the slide template's presence is what gates it.** A hand-built
  headless carousel renders its own DOM, so nobody would stamp the clones - with no template registered
  the count is 0 and `loop` stays the phase-1 wrapping jump. `count()` also comes from the slides array
  rather than the DOM when there is one, which is both immediate (no mutation-observer lag) and consistent
  with the clone arithmetic.
- **The teleport asks which child the track is _resting nearest_, not whether the offset is past the first
  real slide.** The first attempt compared offsets with a 1px tolerance and was wrong: the scrollable
  re-snaps after any programmatic scroll, and it measures with bounding rects, which `dim`'s own
  `scale: 0.92` shifts by a few pixels. So the alignment landed at 1080, snap nudged it to 1075.2, and the
  teleport read that as "in the leading clones" and jumped a whole track to the far end of the carousel -
  reproduced in Storybook, and only in the `js`-driver story, because snap happened to round the other way
  with the timeline driver. Nearest-child has no threshold to get wrong: the children are a slide apart.
- **A looping track needs an explicit initial alignment.** It starts at scroll 0, which is a _clone_; a
  plain teleport from there lands on slide `count - cloneCount`, not slide 1. So there is an effect that
  puts the carousel on the real run once per `cloneCount:count` shape, which also re-lands it on the same
  slide when a breakpoint change rebuilds the clones.
- **The transition CSS is a styles-only component mounted on demand**, not part of `carousel.component.css`.
  Two reasons: the default `transition="none"` then injects none of it, and a _headless_ carousel gets the
  `@property` registration too - which it needs, since an unregistered custom property does not interpolate
  in keyframes.
- **Reduced motion is handled by the driver, not by the effects.** `resolvedTransitionDriver()` returns
  `'none'`, nothing writes the property, and the effect rules are gated on a driver being active - so the
  slides are left alone rather than pinned at their centred values.
- **`slideAlign: 'start' | 'center'`** was added after review: with a multi-item layout the transitions read
  wrong start-aligned, because the progress every effect reads is measured from the **centre**, so at rest
  no slide was at 0 and two neighbours were equally half-dimmed. Centred, a peeking layout is what it should
  be - one current slide at progress 0 with a partial either side. It needed a `snapOrigin` passthrough on
  `<et-scrollable>` (its snapping is ours, not CSS, and the component didn't expose the origin), and the
  loop's resting-offset maths had to become alignment-aware.
- **`wipe` had to be rebuilt, twice.** A `clip-path` inset on the slide is _not_ a wipe: the mask travels
  with the slide, so it is a crop being dragged along - and the first version masked the trailing edge,
  which is the part already off screen, so it was invisible. Masking the leading edge instead made it
  visible but wrong: it chopped the text mid-word. What a wipe actually requires is the content holding
  still while the box moves over it, so each slide's content is now translated by its own displacement from
  centre - `progress × (viewport + slide) / 2`, expressible exactly as `progress × (50cqw + 50%)` with a
  `container-type` on the track, which needs no per-`itemSize` table and gets `auto` right too. Then
  `overflow: clip` on the box is the mask, and the direction falls out of the sign of the progress rather
  than needing cdk's slide-left/slide-right variants. The other two parts of cdk's `mask-slide` are in as
  well: the 125px push (`--et-carousel-wipe-shift`) and the `brightness(0.5)` dip
  (`--et-carousel-wipe-dim`). No easing curve - cdk needed one because its transition ran on a timer, and
  here the scrolling is the timing. It is gated on one slide per view, since pinned content in a
  partly-visible box would show as blank. Demonstrating it also needed a **new story**: between two dark
  cards with corner text there is nothing for a sweeping edge to reveal.
- **Autoplay could not be restarted from its own control.** The pause control lives inside the carousel -
  it has to - so pressing play cleared `isStopped` and then `pauseReason` immediately reported `'hover'` or
  `'focus'` instead, from the pointer and focus still on the button just pressed. Hover/focus _on the pause
  control_ is now subtracted from those pauses (a first attempt made an explicit `start()` outrank them
  until pointer and focus both left, which then swallowed a genuine hover on a slide). Hovering a slide
  still pauses.
- **Navigation had to stop trusting the intersections.** `activeDomIndex` comes from an IntersectionObserver,
  which reports a frame or two late - so a second button press during the first one's animation stepped from
  the slide being left, going nowhere or retargeting the scroll backwards mid-flight ("spamming the buttons
  gives wild animations, sometimes in the wrong direction"). There is now a `requestedDomIndex` that
  everything steps from while a programmatic scroll is in flight, cleared on settle or when a pointer takes
  over, and `activeIndex` reports it - so the dots also move with the press instead of after it.
- **A long jump animates one slide, not all of them.** Jumping five dots along strobed, because a browser
  gives a smooth scroll the same duration whatever the distance and a position-driven transition then runs
  one transition per slide crossed. `goToDomIndex` covers everything beyond the last step instantly and
  animates only that step, and `goTo` picks the nearest _copy_ of the requested slide so a looping carousel
  goes the shorter way round. Which then exposed one more thing: the instant reposition **settles too**, and
  its `scrollend` fired the seam teleport in the middle of the animation still to come - so the settle
  handler now ignores a settle that has not arrived at the requested child.
- **The autoplay countdown ring was barely visible**: a 2px arc drawn at the 24px tap target, with nothing
  behind it. It is now its own smaller size with its own width (`--et-carousel-dot-ring-size` /
  `--et-carousel-dot-ring-width`) and a faint track ring behind it, so a part-finished countdown reads as
  part-finished.
- One thing is **not** fixed, because it could not be reproduced: a rare one-off wiggle after a wipe
  completes, on an Intel Mac and very occasionally on Windows. Traced with a per-frame sampler and a patched
  `Element.prototype.scroll` across six viewport/DPR combinations - no extra scroll of any kind happens after
  the navigation, so it is a compositing artifact rather than a scroll. Left as a known nit.
- **The scrollable snapped mid-gesture.** It snaps once the scrolling has settled, and a gesture is full of
  settled moments: pausing mid-drag for longer than the settle delay scrolled the content out from under
  the finger still holding it. `ScrollableSnapDirective` now gates on `pointerdown`/`pointerup`, which
  covers touch - cdk gates only on its mouse-drag state, so the touch case is still open there.
- Verified in Storybook across 77 checks in four driver scripts: clone marking and label/dot exclusion, the
  initial alignment, teleports in both directions (exactly one track, same slide on screen),
  `next`/`previous` lapping, progress monotonic over −1→1 with both drivers agreeing, `dim` matching its
  formula, all three parts of `wipe`, centred alignment giving partial/full/partial with the middle slide at
  progress 0, `itemSize="auto"` measuring its teleport distance, the `scrollend`-less debounce path,
  teleports deferred until a held pointer is released, autoplay lapping and pause→resume, reduced motion,
  and no snap while a mouse button or a touch is held.

The original specification follows.

### 1. Seamless looping

Today `loop` is a **rewind**: `next()` on the last slide scrolls back to the first, visibly. A carousel
must cross the seam without showing it.

The only way to do that on a native scroller is to have content on both sides of the seam and teleport the
scroll offset across it. Constraints found in this codebase:

- **Clones must be ordinary scrollable children.** The track is a CSS grid (`grid-auto-flow: column`) that
  pins the first and last real item to explicit columns derived from `--item-count`
  (`scrollable.component.css`), and `--item-count` counts `scrollableChildren()`. Marking clones
  `etScrollableIgnoreChild` would exclude them from that count and break the pinning, so clones are counted
  and the **carousel** owns the DOM-index → slide-index mapping (a modulo), not the scrollable.
- **Clones must be live Angular views, not `cloneNode` copies.** A cloned DOM subtree has no bindings, so
  anything interactive or async inside a slide would be dead in the clone (this is the documented cost of
  Swiper's loop mode; it is not acceptable for an Angular library, and `no-direct-dom-manipulation` says so
  too).
- Which forces the API: **slides become data + a template**, and (decided by the user 2026-07-28)
  **template-only - `<et-carousel>` drops projected slides entirely**:

  ```html
  <et-carousel [slides]="items" loop>
    <ng-template etCarouselSlide let-slide let-index="index">…</ng-template>
  </et-carousel>
  ```

  The carousel renders `[tail clones][real slides][head clones]` from that one template, and there is no
  second authoring mode to branch on. Consequences to implement:

  - **The carousel renders the slide wrapper itself** - a `<div etCarouselItem>` per slide view - so slide
    semantics, `N of M` labels, `data-active` and the clone marking (`aria-hidden` + `inert`) are guaranteed
    rather than something a consumer has to remember. `etCarouselItem` stays a **headless** piece, for a
    consumer building a carousel on a bare scrollable.
  - The wrapper is the element the scrollable sizes, and the element the transitions apply to - which is
    also what makes the effects reliable (a known element with a known progress property).
  - **Per-slide autoplay duration** can no longer be an attribute on the consumer's element: replace it with
    an `autoplayTimeFor: ((slide: T, index: number) => number | null) | null` input on the carousel. The
    headless `etCarouselItem[autoplayTime]` keeps working for hand-built carousels.
  - Type the template context and add a static `ngTemplateContextGuard` so `let-slide` is `T`, not `any`
    (the repo already allows this pattern - see the `allow-static-template-context-guard` changeset).
  - Phase 1's stories, spec and docs page all use projected `etCarouselItem` children and **must be
    rewritten** as part of this; nothing is released, so no migration path is owed.

  This also opens the door to virtualizing long carousels later.

Implementation notes:

- Clone count: enough to cover one viewport plus one, derived from the resolved `itemSize`
  (`full` → 1, `half` → 2, `third` → 3, `auto` → measure). Recompute on breakpoint change.
- Teleport: when the active DOM index enters the clone zone, shift `scrollLeft`/`scrollTop` by the real
  track length with `behavior: 'auto'`. Do it on **`scrollend`** (Firefox 109+, Chrome 114+, Safari 26) and
  fall back to a debounced `scroll` where it is missing - never mid-animation, or the jump is visible.
  A teleport during a finger drag must be deferred until the pointer is up.
- Clones are `aria-hidden` + `inert` and excluded from `count()`, the dots, and the `N of M` labels; the
  active dot follows the mapped real index. Slide labels come from the real index, so a clone announces
  nothing.
- `next()`/`previous()`/autoplay stop having an end: `canGoNext`/`canGoPrevious` are always true while
  looping, and `isAtStart`/`isAtEnd` become about the _real_ index for consumers that show progress.
- Edge cases to cover in the spec: fewer slides than fit a viewport (no clones, no loop), a single slide,
  variable-width slides (`itemSize="auto"` - teleport distance must be measured, not computed), and slides
  added/removed while looping (clone views must follow).

### 2. A transition system, not one effect

`transition="dim"` is the floor, not the ceiling, and the fallback question has a better answer than
picking one of the two options: **give every effect one input and fill it two ways.**

- Each slide carries a registered custom property - `--et-carousel-slide-progress`, `syntax: '<number>'` -
  that runs from `-1` (one viewport before centre) through `0` (centred) to `1` (one viewport past).
- **Where scroll-driven animations exist** (Chromium, Safari), a `@keyframes` block animates _that
  property_ along the slide's own `view(inline)` timeline. Zero JavaScript, and the property is already
  proven to interpolate this way - the autoplay ring does it today.
- **Where they don't** (Firefox, still), a fallback driver writes the same property per visible slide from
  a passive `scroll` listener batched into `requestAnimationFrame`. Same variable, same effects, ~N writes
  per frame with N = slides in view.
- Every effect is then **pure CSS reading one number**, which is what makes a library of them cheap:
  - `dim` - today's opacity/scale recede.
  - `wipe` - the Apple-TV-ish `clip-path: inset()` reveal cdk had, now driven by position rather than by a
    class flip, so it tracks a finger.
  - `parallax` - slide content translating slower than the slide.
  - `tilt` - a small `rotate3d` toward the centre.
    Ship `dim` + `wipe` first; the rest are additive and consumers can author their own against the same
    property (documented hook).
- `prefers-reduced-motion` drops all of it (the JS driver never starts either), and a `transitionDriver`
  input (`'auto' | 'scroll-timeline' | 'js' | 'none'`) lets a perf-sensitive page opt out of the fallback.

### Verification

Storybook drive per effect (progress property values at known scroll offsets), a loop story that asserts
the seam is invisible (scroll offset continuity across a teleport plus no change in rendered slide text),
`scrollend`-less path forced by stubbing the event, and the reduced-motion path. The mobile emulator is
worth it here for the drag-and-teleport interaction (`verify-in-mobile-emulator`).

Size: M. Research below done 2026-07-23 against
`libs/cdk/src/lib/components/carousel/` (~970 lines). Net-new in
`libs/components`.

## What cdk ships today

One-item-at-a-time carousel: CSS-grid stack with a single `mask-slide`
transition (`clip-path` wipe + translate + brightness), signal inputs
throughout, rich autoplay (per-item `autoPlayTime`, progress signal polled via
`timer(0,100)`, pause on hover/focus/visibility via IntersectionObserver,
explicit stop/resume), `loop`, navigation lock during transitions, dot nav
with autoplay progress in the active dot, prev/next/play-pause button
directives, good a11y (`inert` + `aria-hidden` on inactive items,
`aria-disabled` on nav). **Zero touch/swipe support** - button/dot only. No
responsive multi-item view.

## Rewrite decision: build on `scrollable`, don't reimplement sliding

`libs/components/src/lib/scrollable` already provides most of a modern
carousel as composable headless directives: native-scroll base with
per-breakpoint item sizing (`ScrollableDirective`), CSS scroll-snap
active-item detection (`ScrollableSnapDirective` + `getScrollSnapTarget`),
drag-to-scroll (`ScrollableDragDirective`/`useCursorDragScroll`), buttons, dot
navigation (`ScrollableNavigationDirective`), edge masks, active-child
tracking. Native scrolling gives **touch/swipe physics for free** - fixing
cdk's biggest gap.

The carousel becomes a thin composition layer:

- `et-carousel` = scrollable configured for snap-per-item, one item per view
  by default (multi-item / peeking views come free via scrollable's
  breakpoint item sizing - a new capability, expose it).
- **New work #1 - autoplay module** (the one thing scrollable lacks): port
  cdk's autoplay semantics as an opt-in directive - per-item duration
  override, progress signal (prefer a rAF/CSS-driven progress over cdk's
  100 ms `timer` polling), pause on hover/focus/hidden
  (`signalHostElementIntersection`), explicit stop/resume, respects
  reduced motion (don't autoplay under `prefers-reduced-motion` - cdk
  didn't handle this).
- **New work #2 - transition question**: native snap-scroll replaces the
  `mask-slide` clip-path effect. Recommend **dropping mask-slide** (decide
  consciously - if a fade/wipe look is truly required somewhere, that's a
  different, non-scrolling component; don't hybridize). `loop` also changes
  meaning with native scroll: implement "advance wraps to start" for
  autoplay/buttons; infinite seamless looping is out of scope v1.
- Dot nav: extend/skin `ScrollableNavigationDirective`; add the autoplay
  progress-in-dot affordance from cdk.
- A11y carries over: `inert`/`aria-hidden` on off-screen items (scrollable
  tracks child visibility already), labeled controls, pause control required
  whenever autoplay is on (WCAG 2.2.2).

Styling: `@layer components`, tokens per `theming` skill - cdk's dot colors
use the old `--et-color-*` raw-RGB tokens; rebuild on surface/color tokens.

## Deliverables

Composition components/directives + autoplay directive, stories (single view,
multi-item/peek, autoplay with progress dots, touch on mobile - consider
`verify-in-mobile-emulator`), docs page (`apps/docs/components/carousel.md`),
changeset. cdk carousel stays untouched.
