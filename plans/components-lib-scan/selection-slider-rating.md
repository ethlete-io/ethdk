# selection-list, slider, rating scan - open findings

Scan of `libs/components/src/lib/forms/selection-list/`, `forms/slider/`, `forms/rating/` from 2026-09-28. 0 High, 0 Medium, 0 Low, 1 Spec (verified 2026-09-28: 3 confirmed, 1 re-rated; Low fixes 2026-09-28: 8 fixed, 1 already covered by the docs). Skipped: stories, and the specs except to check coverage. Slider/range-slider CSS duplication is not listed, because the bundle-size round 2 already rejected that dedupe.

## selection-list

None open.

## slider

None open.

## rating

None open.

## Spec gaps

- Spec: `RatingComponent` pointer logic (drag preview, the click-fallback flag, RTL offsets, half-steps from rects) has no component spec. The directive spec drives only the headless host. M
