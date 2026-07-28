---
'@ethlete/components': minor
---

Add the carousel: `<et-carousel>` with `etCarouselItem` slides, built on the scrollable so swipe, momentum
and keyboard scrolling come from the platform. Multi-item and peeking views via `itemSize` (including
per-breakpoint), opt-in `autoplay` that pauses on hover, focus and off-screen and never runs under
`prefers-reduced-motion` (with the WCAG-required pause control), a scroll-driven `transition="dim"` focus
effect that degrades to a plain scroll where `view()` timelines aren't supported, and the headless
`etCarousel` / `etCarouselAutoplay` / control directives behind `CAROUSEL_IMPORTS`. Adds the `et-play` and `et-pause` icons, and the scrollable's boolean inputs
(`snap`, `renderButtons`, `renderNavigation`, …) now accept bare attributes.
