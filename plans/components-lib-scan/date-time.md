# forms/date-time scan - open findings

Scan of `libs/components/src/lib/forms/date-time/` from 2026-09-28. 0 High, 6 Medium, 10 Low, 3 Spec (verified 2026-09-28: 5 confirmed, 1 re-rated). Skipped: stories, most specs, the component CSS beyond layer and colour checks.

Paths are relative to `forms/date-time/`.

## Duration input

- Low: `internals/duration-format` (`UNIT_MS`, `deriveDurationFormatSpec`, …) is public API through `duration-input/headless/index.ts:3`. S

## Validators

- Low: the validator messages are hardcoded English, and the bound goes through `format` with no locale (`date-time-range-validators.ts:66,119,123,151`). A German app shows "Choose dates on or after 01/05/2026". Read them from `DATE_TIME_LABELS`, as the controls do. S
- Low: single inputs have no bounds validator. `et-date-input`/`et-date-time-input` document that `minDate`/`maxDate` only shape the picker, and signal-forms `min()`/`max()` cannot read a string value, so typed entry outside the bounds has no ready-made check. `dateRangeBounds` exists only for ranges. M

## Keyboard

- Low: Enter commits during IME composition, because `handleKeydown` does not check `event.isComposing` (`internals/date-picker-input-field.directive.ts:151`, `internals/date-range-picker-input-field.directive.ts:207`, `duration-input/headless/duration-input-field.directive.ts:91`). S

## Presets

- Low: the `options` computed reads `new Date()` and has no time dependency, so "Today"/"This week" and their `active` state go stale after midnight until the value or the presets change (`internals/date-range-presets-state.ts:19,28-41`). S

## Cleanup

- Low: `parseInZone` and `viewerTimeZone` are unused outside the spec (`internals/time-zone.ts:19,102`). `viewerTimeZone` duplicates `chart/headless/internals/chart-time-scale.ts:298`. S
- Low: the "reference midnight" comments describe a leak that date-fns does not cause (`date-input/headless/date-input.directive.ts:105-107`, `date-range-input/headless/date-range-input.directive.ts:133-134`, `internals/date-time-parse.ts:25-26`). Verified: every date token parser resets the time to 00:00, so `parse('05.01.2026', 'dd.MM.yyyy', 14:37)` gives midnight. Delete or correct them. S
- Low: the zone plumbing (`effectiveTimeZone`, `resolvedTimeZoneLabel`, the dev-mode warn effect, the local-reading id counter) is duplicated in `date-time-input.directive.ts:95-106,151-156,189-197` and `date-time-range-input.directive.ts:117-137,164-172`. The pane state (`activePane`/`paneNav`/`paneAdvanceSpent`/`showPane`) is duplicated in the two styled components. S
- Low: hardcoded colour `box-shadow: 0 10px 24px rgb(0 0 0 / 0.16)` (`date-picker-panel.component.css:65`). Use a shadow or surface token. S
- Low: `range-input-shell.css` appears in three components' `styleUrls`, so it ships three copies and injects up to three `<style>` tags (`date-range-input.component.ts:18`, `time-range-input.component.ts:18`, `date-time-range-input.component.ts:26`). A shared styles-only component mounted once would dedupe it. S

## Spec gaps

- Spec: no test commits a zoned value while the runtime zone is in its spring-forward gap (typed text and time-picker pick). M
- Spec: no test for a time-only value in the skipped hour on the runtime's DST day. S
- Spec: no duration test for focus and blur with unchanged text, or for unit-suffixed input (`1h30m`). S
