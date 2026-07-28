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
