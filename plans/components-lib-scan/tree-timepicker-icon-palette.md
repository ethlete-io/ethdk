# tree, time-picker, icon, command-palette scan - open findings

Scan of `libs/components/src/lib/{tree,time-picker,icon,command-palette}` from 2026-09-28. 0 High, 5 Medium, 16 Low, 3 Spec. Skipped: stories, the 50 icon data files (read one as a sample), CSS beyond the layer, colour and comment checks.

## icon

- Medium: SDK components register their icons with `providers`, not `viewProviders`, so their `ICONS_TOKEN` shadows the consumer's registration for all projected content (`forms/select/select-option.component.ts:13`, `accordion/accordion.component.ts:29`, `chip/chip.component.ts:11`, `forms/select/select.component.ts:38` and most others in the `provideIcons(` grep). A consumer `<i etIcon="app-flag">` inside an `et-select-option` or an accordion body throws `ICON_NOT_FOUND` unless the icon goes through `provideIconOverrides`. `banner.component.ts:57` and `progress-step.component.ts:71` already use `viewProviders`. Move the rest to `viewProviders`, or merge a parent registry in `provideIcons` with `inject(ICONS_TOKEN, { skipSelf: true, optional: true })`. M Verified.
- Low: a nested `provideIconOverrides` replaces the root overrides and does not merge with them (`icon/headless/icon.directive.ts:42,67`), so a feature-level override hides every app-level override. Merge overrides up the injector chain, or state it in the JSDoc (`icon-provider.ts:164-186`). S
- Low: `data` goes into `innerHTML` through `bypassSecurityTrustHtml` without sanitising (`icon/headless/icon.directive.ts:28,121`), and the SVG shape checks run only in dev mode (`:113`). An `<svg onload=…>` or `<image href="javascript:…">` from a CMS or an API runs. Say on `IconDefinition.data` (`icon-provider.ts:13`) that the value must be trusted, build-time markup. S
- Low: inline `display`/`align-items`/`justify-content` host styles (`icon/headless/icon.directive.ts:35-37`) beat every class, so a consumer cannot set `inline-flex` or `hidden` on an icon without `!important`. Move them to a layered `.et-icon` rule. S
- Low: the host comment at `icon/headless/icon.directive.ts:29-30` repeats the `label` JSDoc, and `:65-66`, `:77-78` narrate the code under them. S

No icon set lands in every bundle: each component registers only its own icon constants, `sideEffects: false` is set, and `ET_BUILT_IN_ICON_NAMES` is a list of names without SVG data.

## tree

- Low: a collapsed branch whose load failed cannot be reopened in one action (`tree/headless/tree.directive.ts:428-432`, `:701-705`). `activate` calls `retry` and skips `toggleExpansion`, and `isIdle` loads only expanded branches, so the click resets the level and loads nothing. ArrowRight (`:521-522`) expands the branch but keeps the old `ERROR` level and shows the old failure with no new request. Expand in `activate` when it retries, and reset an errored level to `IDLE` on `expand`. S Verified. Re-rated from Medium: a second click, or Enter after ArrowRight, loads the branch.
- Low: `visibleRows` is O(nodes × loaded levels) (`tree/headless/tree.directive.ts:148-149,166`), because each node does a linear `levels.find` with `compareWith`. It recomputes on every expand, select and focus change, and `rowOf`/`elementOf` (`:592-605`) add a linear scan per call. A tree with a few hundred loaded branches does 10^5+ comparisons per keystroke. Key levels in a `Map` when `compareWith` is the default, or index them once per recompute. M Verified. Re-rated from Medium: `visibleRows` reads only `levels`, `expandedValues` and `compareWith`, so it does not recompute on select or focus, only on expand and load.
- Low: `retry` on a branch with a load in flight starts a second request, and the two responses write in arrival order (`tree/headless/tree.directive.ts:370-372,683-693`). A slow first response overwrites the retried result. Ignore a response whose level is no longer in the `LOADING` state it set. S
- Low: the root error row reacts to Enter only (`tree/tree.component.html:34`). Space does nothing on a focused `treeitem` there. S
- Low: narration comments in `tree/headless/tree.directive.ts:232,236-238,257,263-264,273` and many rationale comments in `tree/tree.component.css` (for example `:2-3,52,76,99,154,162,180`) break the AGENTS.md allowlist. S

## time-picker

- Medium: `min` later than `max` (an overnight window such as 22:00-06:00) disables every option, with no dev error (`time-picker/headless/internals/time-availability.ts:37-43`). A night-shift picker becomes unusable. Treat `min > max` as a window that wraps past midnight, or throw in dev mode and document it in `apps/docs/components/time-picker.md:61`. S Verified.
- Medium: when the format hides seconds, the bound checks use the seconds of the current value (`time-picker/headless/time-picker.directive.ts:326`), and a commit keeps them together with the milliseconds (`:659-673`, `time-availability.ts:30-31`). With `value = new Date()` (seconds 30) and `max` 17:00, the whole 17 hour is disabled, and every pick emits a value with stray seconds. Use second 0 and clear the milliseconds when `showSeconds` is false. S Verified.
- Low: `now` is read once at construction (`time-picker/headless/time-picker.directive.ts:181`). A picker that stays mounted keeps an old anchor and an old `day` for `timeFilter`, which is wrong across midnight for per-weekday filters. S
- Low: with a seconds format, `minuteStep`/`secondStep` of 1 and a `timeFilter`, `columns` can call the filter tens of thousands of times per pick (`time-picker/headless/time-picker.directive.ts:339,408-410`, `time-availability.ts:57-64`), and each call creates a `Date`. Compute hour and minute availability from `min`/`max` first and call the filter only inside the bounds. M
- Low: the scroll effect reads layout in an `effect` for each option (`time-picker/headless/time-picker-option.directive.ts:57-61`). It runs before the render that inserts a new off-step option, so the first scroll can measure an old layout. Use `afterRenderEffect`, as `command-palette-item.component.ts:39` does. S

## command-palette

- Medium: the palette runs the active command on an Enter that confirms an IME composition, and moves the highlight on arrow keys during composition (`command-palette/headless/command-palette.directive.ts:124-156`). A Japanese or Chinese user runs a command while typing the query. Return early on `event.isComposing` (the masked input already does this, `forms/masked-input/headless/input-mask.directive.ts:219`). S Verified. Safari also sends the commit Enter with `isComposing` false, so check `keyCode === 229` too.
- Medium: group ids come from the label with only `[a-z0-9]` kept (`command-palette/command-palette.component.ts:57-59`), so non-Latin labels ("Дата", "設定") and labels that differ only in punctuation or umlauts get the same id. Every such group then has `aria-labelledby` on the first heading. Build the id from the group index. S Verified.
- Low: the global chord listener ignores `event.repeat` and `event.defaultPrevented` (`command-palette/command-palette-shortcut.directive.ts:72-81`). A held `mod+k` opens and closes the palette again and again, and a focused widget that handles the same chord cannot stop it. S
- Low: `fuzzyMatch` indexes `haystack` and `haystack.toLowerCase()` with the same index (`command-palette/headless/internals/fuzzy-match.ts:79-80,122,126`). For characters whose lower case has a different length ("İ"), the match positions and highlighted segments move. Lower case per character, or fall back to no highlight when the lengths differ. S
- Low: `closeOnRun` has no `booleanAttribute` transform (`command-palette/headless/command-palette.directive.ts:32`), unlike the other boolean inputs in the lib. S
- Low: the rationale comments at `command-palette/command-palette.component.ts:44-51` ("same reasoning as the menu's panel") break the AGENTS.md allowlist. S

## Spec gaps

- Spec: the tree has no spec for the headless directive. Nothing covers collapse-then-reopen of a failed branch, `retry` during a load, or `expandedValues` restored before the branch loads. M
- Spec: the time-picker specs do not cover `min > max`, a value with hidden seconds against `max`, or 12-hour period switching under a bound. S
- Spec: no command-palette spec covers IME composition or a duplicate group id. S
