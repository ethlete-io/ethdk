# menu, carousel, calendar scan - open findings

Scan of `libs/components/src/lib/menu/`, `libs/components/src/lib/carousel/`, `libs/components/src/lib/calendar/` from 2026-09-28. 0 High, 1 Medium open (7 fixed 2026-09-28), 2 Low, 1 Spec (verified 2026-09-28). No security findings. Skipped: stories, specs (read only for coverage), `testing/` drivers, `scrollable/` internals the carousel calls into.

## menu

- Low: hardcoded shadow colour `rgb(0 0 0 / 0.16)` as the primary value (`menu/menu.component.css:124`). Take it from a token. S

## carousel


## calendar

- Medium: range strategies can return an end that is disabled or after `max`, and `commitSelection` stores it without a check (`calendar/headless/calendar-range-strategy.ts:90-94`, `calendar/headless/calendar.directive.ts:744-751`). `createFixedLengthRangeStrategy({ days: 7 })` picked 3 days before `max` gives a range that ends past `max`. Clamp or reject a resolved range outside the availability. S Verified.
- Low: the default strategy previews a band from the hovered day to the start when you hover before the start (`calendar/headless/calendar-range-strategy.ts:114-123`), but a click there restarts the range at that day (`:104-105`). The preview promises a different result than the click gives. Make the two agree. S

## Spec gaps

- Spec: no calendar test for a range strategy result outside the availability. S
