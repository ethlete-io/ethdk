# selection-list, slider, rating scan - open findings

Scan of `libs/components/src/lib/forms/selection-list/`, `forms/slider/`, `forms/rating/` from 2026-09-28. 0 High, 0 Medium, 4 Low, 2 Spec (verified 2026-09-28: 3 confirmed, 1 re-rated; Low fixes 2026-09-28: 8 fixed, 1 already covered by the docs). Skipped: stories, and the specs except to check coverage. Slider/range-slider CSS duplication is not listed, because the bundle-size round 2 already rejected that dedupe.

## selection-list

- Low: `(keydown.enter)` selects and calls `preventDefault` (`selection-option.directive.ts:33`, `selection-list-control.directive.ts:16`). This blocks implicit form submission from a radio group. APG radio and checkbox use Space only. S
- Low: history-narration comment at `selection-state.ts:69-74` ("meant a single disabled ... pinned"). The other three comments are gone; this file had another agent's uncommitted edit to the same comment. S
- Low: `labelId` is a `signal` that never changes (`selection-option.directive.ts:61`). A readonly field is enough. S

## slider

None open.

## rating

- Low: PageUp and PageDown are not handled (`rating.directive.ts:211-250`). The slider role expects them. With `max` of 10 and half steps, a user must press 20 times. S

## Spec gaps

- Spec: no slider-engine spec for `step <= 0`. (The off-grid `minDistance` case is now covered in the range-slider directive spec.) S
- Spec: `RatingComponent` pointer logic (drag preview, the click-fallback flag, RTL offsets, half-steps from rects) has no component spec. The directive spec drives only the headless host. M
