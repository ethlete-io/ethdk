# 06 — Carousel

**Status: shipped 2026-07-28.** `libs/components/src/lib/carousel/` — headless `etCarousel` (active
slide from the scrollable's intersections, `next`/`previous`/`goTo`, `loop`, region semantics),
`etCarouselItem` (slide semantics + per-slide duration), opt-in `etCarouselAutoplay`, the three control
directives, default `et-carousel`, `CAROUSEL_IMPORTS`, `provideCarouselLabels`, error codes ET38xx,
stories, spec, docs page, changeset. Adds the `et-play`/`et-pause` icons and `booleanAttribute`
transforms on the scrollable's boolean inputs.

Deviations and decisions beyond the plan below:

- **Where `etCarousel` goes.** It needs the scrollable, but the slides and controls need _it_ — and DI
  only looks upwards. So it takes its track from its own element, from its content, or from
  `<et-carousel>` handing it over, and the recommended headless shape is a wrapper around both the
  scrollable and the controls. (First attempt put it on the inner scrollable inside the Tier 3 template;
  projected slides and the controls then resolved `null`, which the Storybook run caught.)
- **`goTo` scrolls with `origin: 'start'`.** The scrollable's default `'nearest'` deliberately does
  nothing for an element merely _adjacent_ to the viewport edge — which is exactly where the next slide
  sits at one-slide-per-view, so `next()` never moved.
- **Autoplay restarts the slide's full duration on resume** rather than continuing a partial one, so the
  progress ring (a CSS animation, rendered only while the countdown runs) and the timer are one clock and
  cannot drift. Reduced motion refuses to play at all; the WCAG 2.2.2 pause control is enforced in dev.
- **Slide transitions are scroll-driven, not JS.** `transition="dim"` runs each slide's keyframes on its
  own `view()` timeline, so the effect tracks a drag instead of stepping on an "active" flag — the closest
  honest equivalent of cdk's Apple-TV-ish mask-slide in a scrolling carousel. It sits behind
  `@supports (animation-timeline: view(inline))` + `prefers-reduced-motion`, so browsers without
  scroll-driven animations (Firefox, as of this writing) get the plain scroll. `data-transition` on the
  host plus `.et-carousel-item` is the hook for consumers' own effects (e.g. a clip-path wipe).
- **Off-screen slides are not hidden.** cdk stacked its slides and had to `inert` them; a scrolling
  carousel must leave them reachable by scroll and by Tab.

## Phase 2 (planned 2026-07-28, not started) — a real carousel

Phase 1 shipped the composition, and the review of it is fair: it is a scrollable with chrome. Two things
are missing that are the _point_ of a carousel, and both are specified here.

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
  **template-only — `<et-carousel>` drops projected slides entirely**:

  ```html
  <et-carousel [slides]="items" loop>
    <ng-template etCarouselSlide let-slide let-index="index">…</ng-template>
  </et-carousel>
  ```

  The carousel renders `[tail clones][real slides][head clones]` from that one template, and there is no
  second authoring mode to branch on. Consequences to implement:

  - **The carousel renders the slide wrapper itself** — a `<div etCarouselItem>` per slide view — so slide
    semantics, `N of M` labels, `data-active` and the clone marking (`aria-hidden` + `inert`) are guaranteed
    rather than something a consumer has to remember. `etCarouselItem` stays a **headless** piece, for a
    consumer building a carousel on a bare scrollable.
  - The wrapper is the element the scrollable sizes, and the element the transitions apply to — which is
    also what makes the effects reliable (a known element with a known progress property).
  - **Per-slide autoplay duration** can no longer be an attribute on the consumer's element: replace it with
    an `autoplayTimeFor: ((slide: T, index: number) => number | null) | null` input on the carousel. The
    headless `etCarouselItem[autoplayTime]` keeps working for hand-built carousels.
  - Type the template context and add a static `ngTemplateContextGuard` so `let-slide` is `T`, not `any`
    (the repo already allows this pattern — see the `allow-static-template-context-guard` changeset).
  - Phase 1's stories, spec and docs page all use projected `etCarouselItem` children and **must be
    rewritten** as part of this; nothing is released, so no migration path is owed.

  This also opens the door to virtualizing long carousels later.

Implementation notes:

- Clone count: enough to cover one viewport plus one, derived from the resolved `itemSize`
  (`full` → 1, `half` → 2, `third` → 3, `auto` → measure). Recompute on breakpoint change.
- Teleport: when the active DOM index enters the clone zone, shift `scrollLeft`/`scrollTop` by the real
  track length with `behavior: 'auto'`. Do it on **`scrollend`** (Firefox 109+, Chrome 114+, Safari 26) and
  fall back to a debounced `scroll` where it is missing — never mid-animation, or the jump is visible.
  A teleport during a finger drag must be deferred until the pointer is up.
- Clones are `aria-hidden` + `inert` and excluded from `count()`, the dots, and the `N of M` labels; the
  active dot follows the mapped real index. Slide labels come from the real index, so a clone announces
  nothing.
- `next()`/`previous()`/autoplay stop having an end: `canGoNext`/`canGoPrevious` are always true while
  looping, and `isAtStart`/`isAtEnd` become about the _real_ index for consumers that show progress.
- Edge cases to cover in the spec: fewer slides than fit a viewport (no clones, no loop), a single slide,
  variable-width slides (`itemSize="auto"` — teleport distance must be measured, not computed), and slides
  added/removed while looping (clone views must follow).

### 2. A transition system, not one effect

`transition="dim"` is the floor, not the ceiling, and the fallback question has a better answer than
picking one of the two options: **give every effect one input and fill it two ways.**

- Each slide carries a registered custom property — `--et-carousel-slide-progress`, `syntax: '<number>'` —
  that runs from `-1` (one viewport before centre) through `0` (centred) to `1` (one viewport past).
- **Where scroll-driven animations exist** (Chromium, Safari), a `@keyframes` block animates _that
  property_ along the slide's own `view(inline)` timeline. Zero JavaScript, and the property is already
  proven to interpolate this way — the autoplay ring does it today.
- **Where they don't** (Firefox, still), a fallback driver writes the same property per visible slide from
  a passive `scroll` listener batched into `requestAnimationFrame`. Same variable, same effects, ~N writes
  per frame with N = slides in view.
- Every effect is then **pure CSS reading one number**, which is what makes a library of them cheap:
  - `dim` — today's opacity/scale recede.
  - `wipe` — the Apple-TV-ish `clip-path: inset()` reveal cdk had, now driven by position rather than by a
    class flip, so it tracks a finger.
  - `parallax` — slide content translating slower than the slide.
  - `tilt` — a small `rotate3d` toward the centre.
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
`aria-disabled` on nav). **Zero touch/swipe support** — button/dot only. No
responsive multi-item view.

## Rewrite decision: build on `scrollable`, don't reimplement sliding

`libs/components/src/lib/scrollable` already provides most of a modern
carousel as composable headless directives: native-scroll base with
per-breakpoint item sizing (`ScrollableDirective`), CSS scroll-snap
active-item detection (`ScrollableSnapDirective` + `getScrollSnapTarget`),
drag-to-scroll (`ScrollableDragDirective`/`useCursorDragScroll`), buttons, dot
navigation (`ScrollableNavigationDirective`), edge masks, active-child
tracking. Native scrolling gives **touch/swipe physics for free** — fixing
cdk's biggest gap.

The carousel becomes a thin composition layer:

- `et-carousel` = scrollable configured for snap-per-item, one item per view
  by default (multi-item / peeking views come free via scrollable's
  breakpoint item sizing — a new capability, expose it).
- **New work #1 — autoplay module** (the one thing scrollable lacks): port
  cdk's autoplay semantics as an opt-in directive — per-item duration
  override, progress signal (prefer a rAF/CSS-driven progress over cdk's
  100 ms `timer` polling), pause on hover/focus/hidden
  (`signalHostElementIntersection`), explicit stop/resume, respects
  reduced motion (don't autoplay under `prefers-reduced-motion` — cdk
  didn't handle this).
- **New work #2 — transition question**: native snap-scroll replaces the
  `mask-slide` clip-path effect. Recommend **dropping mask-slide** (decide
  consciously — if a fade/wipe look is truly required somewhere, that's a
  different, non-scrolling component; don't hybridize). `loop` also changes
  meaning with native scroll: implement "advance wraps to start" for
  autoplay/buttons; infinite seamless looping is out of scope v1.
- Dot nav: extend/skin `ScrollableNavigationDirective`; add the autoplay
  progress-in-dot affordance from cdk.
- A11y carries over: `inert`/`aria-hidden` on off-screen items (scrollable
  tracks child visibility already), labeled controls, pause control required
  whenever autoplay is on (WCAG 2.2.2).

Styling: `@layer components`, tokens per `theming` skill — cdk's dot colors
use the old `--et-color-*` raw-RGB tokens; rebuild on surface/color tokens.

## Deliverables

Composition components/directives + autoplay directive, stories (single view,
multi-item/peek, autoplay with progress dots, touch on mobile — consider
`verify-in-mobile-emulator`), docs page (`apps/docs/components/carousel.md`),
changeset. cdk carousel stays untouched.
