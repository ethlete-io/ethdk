# menu, carousel, calendar scan - open findings

Scan of `libs/components/src/lib/menu/`, `libs/components/src/lib/carousel/`, `libs/components/src/lib/calendar/` from 2026-09-28. 0 High, 1 Medium open (7 fixed 2026-09-28), 8 Low, 1 Spec (verified 2026-09-28). No security findings. Skipped: stories, specs (read only for coverage), `testing/` drivers, `scrollable/` internals the carousel calls into.

## menu

- Low: hardcoded shadow colour `rgb(0 0 0 / 0.16)` as the primary value (`menu/menu.component.css:124`). Take it from a token. S

## carousel

- Low: the play toggle changes its `aria-label` (play/pause) and also sets `aria-pressed` (`carousel/headless/carousel-controls.directive.ts:94,109-115`). A screen reader announces "Pause automatic slide show, pressed", which reads as the opposite state. Keep one of the two. S
- Low: under reduced motion (or off-screen) the toggle offers "Start" but `start()` changes nothing, because `isStopped` is already false (`carousel/headless/carousel-autoplay.directive.ts:253-259`). The control looks broken. Hide the toggle or disable it when the pause reason is `'reduced-motion'`. S
- Low: `<et-carousel>` always attaches `CarouselAutoplayDirective`, so each instance runs a host IntersectionObserver and a document-visibility listener with autoplay off (`carousel/carousel.component.ts:91-94`, `carousel/headless/carousel-autoplay.directive.ts:103`). Create the intersection signal only when enabled. M
- Low: public and `@internal` JSDoc well past the 1-2 sentence rule, with measurements and history (`carousel/headless/carousel.directive.ts:138-151`, `carousel/headless/carousel-autoplay.directive.ts:105-114,135-144`, `carousel/headless/internals/carousel-loop.ts:27-36,55-81`). The CSS carries essay comments with narration ("what this file used to be") at `carousel/carousel-transition-styles.component.css:1-60`, and template comments at `carousel/carousel.component.html:43-49,74-77`. Cut to the allowlist. M

## calendar

- Low: keyboard navigation does not respect `min`/`max` (`calendar/headless/calendar.directive.ts:691-708,815-829`). `PageUp`/`PageDown` and the arrows move the visible month past the limits while the previous and next buttons are disabled (`canGoPrev`/`canGoNext`). Clamp the target date to `[min, max]` before `moveFocus`. S Re-rated from Medium: the calendar guide documents that disabled days stay focusable, so only paging into whole months past the limits is inconsistent.
- Medium: range strategies can return an end that is disabled or after `max`, and `commitSelection` stores it without a check (`calendar/headless/calendar-range-strategy.ts:90-94`, `calendar/headless/calendar.directive.ts:744-751`). `createFixedLengthRangeStrategy({ days: 7 })` picked 3 days before `max` gives a range that ends past `max`. Clamp or reject a resolved range outside the availability. S Verified.
- Low: the default strategy previews a band from the hovered day to the start when you hover before the start (`calendar/headless/calendar-range-strategy.ts:114-123`), but a click there restarts the range at that day (`:104-105`). The preview promises a different result than the click gives. Make the two agree. S
- Low: `today` is read once at construction (`calendar/headless/calendar.directive.ts:223`). A calendar left open past midnight marks the wrong day with `aria-current="date"` and uses the wrong fallback anchor. S

## Spec gaps

- Spec: no calendar test for keyboard paging against `min`/`max`, and none for a range strategy result outside the availability. S
