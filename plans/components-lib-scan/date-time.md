# forms/date-time scan - open findings

Scan of `libs/components/src/lib/forms/date-time/` from 2026-09-28. 0 High, 0 Medium, 2 Low, 3 Spec (verified 2026-09-28: 5 confirmed, 1 re-rated). Skipped: stories, most specs, the component CSS beyond layer and colour checks.

Paths are relative to `forms/date-time/`.

## Duration input

- Low: `internals/duration-format` (`UNIT_MS`, `deriveDurationFormatSpec`, …) is public API through `duration-input/headless/index.ts:3`. S

## Validators

- Low: single inputs have no bounds validator. `et-date-input`/`et-date-time-input` document that `minDate`/`maxDate` only shape the picker, and signal-forms `min()`/`max()` cannot read a string value, so typed entry outside the bounds has no ready-made check. `dateRangeBounds` exists only for ranges. M

## Spec gaps

- Spec: no test commits a zoned value while the runtime zone is in its spring-forward gap (typed text and time-picker pick). M
- Spec: no test for a time-only value in the skipped hour on the runtime's DST day. S
- Spec: no duration test for focus and blur with unchanged text, or for unit-suffixed input (`1h30m`). S
