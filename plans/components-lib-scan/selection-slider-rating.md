# selection-list, slider, rating scan - open findings

Scan of `libs/components/src/lib/forms/selection-list/`, `forms/slider/`, `forms/rating/` from 2026-09-28. 0 High, 0 Medium, 2 Low, 2 Spec (verified 2026-09-28: 3 confirmed, 1 re-rated; Low fixes 2026-09-28: 8 fixed, 1 already covered by the docs). Skipped: stories, and the specs except to check coverage. Slider/range-slider CSS duplication is not listed, because the bundle-size round 2 already rejected that dedupe.

## selection-list

- Low: `labelId` is a `signal` that never changes (`selection-option.directive.ts:59`). A readonly field is enough. S

## slider

None open.

## rating

- Low: PageUp and PageDown are not handled (`rating/headless/rating.directive.ts:199-250`). The slider role expects them. With `max` of 10 and half steps, a user must press 20 times. S

## Spec gaps

- Spec: no slider-engine spec for `step <= 0`. (The off-grid `minDistance` case is now covered in the range-slider directive spec.) S
- Spec: `RatingComponent` pointer logic (drag preview, the click-fallback flag, RTL offsets, half-steps from rects) has no component spec. The directive spec drives only the headless host. M
