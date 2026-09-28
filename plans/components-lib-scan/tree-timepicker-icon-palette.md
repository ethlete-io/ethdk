# tree, time-picker, icon, command-palette scan - open findings

Scan of `libs/components/src/lib/{tree,time-picker,icon,command-palette}` from 2026-09-28. 0 High, 0 Medium, 11 Low, 3 Spec. Skipped: stories, the 50 icon data files (read one as a sample), CSS beyond the layer, colour and comment checks.

## icon

- Low: a nested `provideIconOverrides` replaces the root overrides and does not merge with them (`icon/headless/icon.directive.ts:42,67`), so a feature-level override hides every app-level override. Merge overrides up the injector chain, or state it in the JSDoc (`icon-provider.ts:164-186`). S
- Low: `data` goes into `innerHTML` through `bypassSecurityTrustHtml` without sanitising (`icon/headless/icon.directive.ts:28,121`), and the SVG shape checks run only in dev mode (`:113`). An `<svg onload=…>` or `<image href="javascript:…">` from a CMS or an API runs. Say on `IconDefinition.data` (`icon-provider.ts:13`) that the value must be trusted, build-time markup. S
- Low: inline `display`/`align-items`/`justify-content` host styles (`icon/headless/icon.directive.ts:35-37`) beat every class, so a consumer cannot set `inline-flex` or `hidden` on an icon without `!important`. Move them to a layered `.et-icon` rule. S
- Low: the host comment at `icon/headless/icon.directive.ts:29-30` repeats the `label` JSDoc, and `:65-66`, `:77-78` narrate the code under them. S

No icon set lands in every bundle: each component registers only its own icon constants, `sideEffects: false` is set, and `ET_BUILT_IN_ICON_NAMES` is a list of names without SVG data.

## tree


## time-picker

- Low: `now` is read once at construction (`time-picker/headless/time-picker.directive.ts:181`). A picker that stays mounted keeps an old anchor and an old `day` for `timeFilter`, which is wrong across midnight for per-weekday filters. S
- Low: with a seconds format, `minuteStep`/`secondStep` of 1 and a `timeFilter`, `columns` can call the filter tens of thousands of times per pick (`time-picker/headless/time-picker.directive.ts:339,408-410`, `time-availability.ts:57-64`), and each call creates a `Date`. Compute hour and minute availability from `min`/`max` first and call the filter only inside the bounds. M
- Low: the scroll effect reads layout in an `effect` for each option (`time-picker/headless/time-picker-option.directive.ts:57-61`). It runs before the render that inserts a new off-step option, so the first scroll can measure an old layout. Use `afterRenderEffect`, as `command-palette-item.component.ts:39` does. S

## command-palette

- Low: the global chord listener ignores `event.repeat` and `event.defaultPrevented` (`command-palette/command-palette-shortcut.directive.ts:72-81`). A held `mod+k` opens and closes the palette again and again, and a focused widget that handles the same chord cannot stop it. S
- Low: `fuzzyMatch` indexes `haystack` and `haystack.toLowerCase()` with the same index (`command-palette/headless/internals/fuzzy-match.ts:79-80,122,126`). For characters whose lower case has a different length ("İ"), the match positions and highlighted segments move. Lower case per character, or fall back to no highlight when the lengths differ. S
- Low: `closeOnRun` has no `booleanAttribute` transform (`command-palette/headless/command-palette.directive.ts:32`), unlike the other boolean inputs in the lib. S
- Low: the rationale comments at `command-palette/command-palette.component.ts:44-51` ("same reasoning as the menu's panel") break the AGENTS.md allowlist. S

## Spec gaps

- Spec: the tree has no spec for the headless directive. Nothing covers collapse-then-reopen of a failed branch, `retry` during a load, or `expandedValues` restored before the branch loads. M
- Spec: the time-picker specs do not cover `min > max`, a value with hidden seconds against `max`, or 12-hour period switching under a bound. S
- Spec: no command-palette spec covers IME composition or a duplicate group id. S
