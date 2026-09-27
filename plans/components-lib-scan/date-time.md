# forms/date-time scan - open findings

Scan of `libs/components/src/lib/forms/date-time/` from 2026-09-28. 0 High, 6 Medium, 10 Low, 3 Spec (verified 2026-09-28: 5 confirmed, 1 re-rated). Skipped: stories, most specs, the component CSS beyond layer and colour checks.

Paths are relative to `forms/date-time/`.

## Time zones and DST

- Medium: with `timeZone` set and a `valueFormat` that has no offset token (`provideDateFormat("yyyy-MM-dd'T'HH:mm:ss")`), the value is written as the zone's wall clock but read back as the runtime's wall clock (`date-time-input/headless/date-time-input.directive.ts:120`, `internals/date-range-picker-input.directive.ts:348`, `internals/time-zone.ts:99`). Verified: 10:00 Tokyo commits `2026-08-18T10:00:00`, and the field then shows 17:00 in a Berlin browser. Each later pick builds on the wrong instant. Fix: read the value with the unused `parseInZone` when a zone is set, or warn in dev mode when `valueFormat` has no `X`/`x`/`O`/`Z` token. S Verified (repro). Re-rated from High: it needs a non-default offsetless `valueFormat`; the default `xxx` format round-trips.
- Medium: zoned commits go through a local `Date`, so a wall clock inside the runtime's own spring-forward gap commits one hour late in the target zone (`internals/time-zone.ts:113-114,127-137`, `date-time-input/headless/date-time-input.directive.ts:212,252`, `date-time-range-input/headless/date-time-range-input.directive.ts:214`, `internals/date-range-picker-input.directive.ts:238`). A Berlin user who types or picks 02:30 on 29 Mar in an `Asia/Tokyo` field gets 03:30 Tokyo. The time picker builds the candidate with `setHours` on the proxy day, and `parseDateValue` builds it with local `parse`, so both paths lose the hour before `localFields` reads it. This contradicts the docs (`apps/docs/components/date-time-inputs.md`, "the committed value is always exact"). Fix: parse with date-fns v4 `{ in: tz(zone) }` and pass wall-clock fields, not a `Date`, from the picker. M Verified (repro).
- Medium: `minDate`/`maxDate`/`dateFilter`/`minTime`/`maxTime`/`timeFilter` go to the calendar and time picker unchanged, but with `timeZone` set those pickers work on zone wall-clock proxies (`date-time-input/date-time-input.component.html:58-60,75-77`, same in `date-time-range-input/date-time-range-input.component.html`). A `minDate` of "now" disables days in the runtime's calendar, not the zone's. A `timeFilter` gets a proxy `Date`, not the "full candidate timestamp" the JSDoc promises (`date-time-input.directive.ts:79-82`). Fix: convert bounds with `zonedProxy` before they go to the pickers, and document that filters get the proxy. S Verified.
- Medium: time-only values parse on today's date, so on the runtime's DST day a value in the skipped hour shows and commits one hour late (`time-input/headless/time-input.directive.ts:50`, `time-range-input/headless/time-range-input.directive.ts:65`, `internals/date-range-picker-input.directive.ts:348` with no reference at all). Verified: `02:30` parses to 03:30 on 29 Mar 2026 in Berlin, and a picker pick of 02:30 writes `03:30`. Fix: use a fixed reference day with no DST change (for example `new Date(2000, 0, 1)`) for all time-only parses. S Verified (repro).

## Duration input

- Medium: every blur re-parses the field, so a value finer than the smallest segment changes on a plain focus and blur (`duration-input/headless/duration-input-field.directive.ts:83`, `duration-input/headless/duration-input.directive.ts:132`). `1500` under `mm:ss` shows `00:01` and blur commits `1000`. Negative values become `0` in the same way (`duration-format.ts:65`). Fix: skip the commit when the text equals `displayValue()` and there is no parse error, as `resolvePickerCommit` does. S Verified.
- Medium: `parseDuration` accepts `h`/`m`/`s` letters but ignores them and fills the digit groups from the right (`duration-input/headless/internals/duration-format.ts:107-122`). Under `hh:mm:ss` the input `1h30m` becomes 1 min 30 s, not 1 h 30 min. Fix: map a suffixed group to its unit, or reject letters. S Verified.
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
