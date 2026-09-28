# selection-list, slider, rating scan - open findings

Scan of `libs/components/src/lib/forms/selection-list/`, `forms/slider/`, `forms/rating/` from 2026-09-28. 0 High, 3 Medium, 13 Low, 3 Spec (verified 2026-09-28: 3 confirmed, 1 re-rated). Skipped: stories, and the specs except to check coverage. Slider/range-slider CSS duplication is not listed, because the bundle-size round 2 already rejected that dedupe.

## selection-list

- Low: `(keydown.enter)` selects and calls `preventDefault` (`selection-option.directive.ts:33`, `selection-list-control.directive.ts:16`). This blocks implicit form submission from a radio group. APG radio and checkbox use Space only. S
- Low: `SegmentedButtonGroupComponent.lastActiveBackgroundElement` keeps a reference to the background of a destroyed button until the next selection (`forms/selection-list/segmented-button-group/segmented-button.component.ts:47`). Clear the reference on destroy when it points to this button. S
- Low: comments outside the allowlist: history narration at `selection-state.ts:69-74` ("meant a single disabled ... pinned"), rationale at `selection-list-control.directive.ts:7-8`, `selection-option.directive.ts:57-58`, `selection-list.directive.ts:32-33`. S
- Low: `labelId` is a `signal` that never changes (`selection-option.directive.ts:61`). A readonly field is enough. S

## slider

- Low: when `minDistance` is not a multiple of `step`, the second snap in `constrainAndSnap` rounds to the nearest grid value and can land inside the gap (`forms/slider/headless/range-slider.directive.ts:279-281`). Example: step 10, minDistance 5, end at 50 gives start 50. Snap with the direction away from the sibling, as the mark branch already does. S
- Low: `thumbAriaBounds` can emit `aria-valuemin` > `aria-valuemax` when the value breaks `minDistance` near a track end (`range-slider.directive.ts:187-189`). Example: `[0, 5]` with minDistance 10 gives the start thumb max -5. Clamp the sibling bound into `[effectiveMin, effectiveMax]`. S
- Low: `void index` stubs exist only to use a parameter that the contract does not require (`forms/slider/headless/slider.directive.ts:171,189-190`). Drop the parameter. TS accepts the shorter signature. S
- Low: the thumb shadow uses a hardcoded colour `rgb(0 0 0 / 0.25)` (`slider.component.css:127`, `range-slider.component.css:128`). Use a shadow token, or a `var(--token, <fallback>)`. S

## rating

- Low: `valueFromPosition` calls `getComputedStyle` once per icon on every pointermove, through `offsetFromInlineStart` (`forms/rating/rating.component.ts:162-185`). Each call can force a style recalc during a drag. Read `direction` once per call and pass it in. S Re-rated from Medium: nothing writes to the DOM inside the loop, so only the first read can recalc styles and `getBoundingClientRect` already forces layout; the rest are cheap.
- Low: Home commits `step` (1 or 0.5), but the host announces `aria-valuemin="0"`, and ArrowDown can reach "empty" (`forms/rating/headless/rating.directive.ts:33,229-233`). The ARIA minimum and the keyboard minimum disagree. Align them, or document Backspace as the way to reach 0. S
- Low: PageUp and PageDown are not handled (`rating.directive.ts:211-250`). The slider role expects them. With `max` of 10 and half steps, a user must press 20 times. S
- Low: `RatingIconDirective` has its own copy of the singleton check and cleanup (`forms/rating/headless/rating-icon.directive.ts:22-37`). `SliderThumbLabelDirective` uses the shared `registerSingleton` for the same job. S
- Low: rationale comments in the template (`forms/rating/rating.component.html:3-4,13-14,36`) and the pointer-flag narration (`rating.component.ts:74-76`). S

## Spec gaps

- Spec: no slider-engine spec for `step <= 0` or for a `minDistance` that is off the step grid. S
- Spec: `RatingComponent` pointer logic (drag preview, the click-fallback flag, RTL offsets, half-steps from rects) has no component spec. The directive spec drives only the headless host. M
