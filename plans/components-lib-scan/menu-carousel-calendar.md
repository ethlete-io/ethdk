# menu, carousel, calendar scan - open findings

Scan of `libs/components/src/lib/menu/`, `libs/components/src/lib/carousel/`, `libs/components/src/lib/calendar/` from 2026-09-28. 0 High, 0 Medium open (8 fixed 2026-09-28), 1 Low, 0 Spec (verified 2026-09-28). No security findings. Skipped: stories, specs (read only for coverage), `testing/` drivers, `scrollable/` internals the carousel calls into.

## carousel

## calendar

- Low: the default strategy previews a band from the hovered day to the start when you hover before the start (`calendar/headless/calendar-range-strategy.ts:113-123`), but a click there restarts the range at that day (`:104`). The preview promises a different result than the click gives. Its JSDoc now says so; make the two agree or keep it as documented. S
