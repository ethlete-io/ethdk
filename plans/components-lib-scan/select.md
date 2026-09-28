# forms/select scan - open findings

Scan of `libs/components/src/lib/forms/select/` from 2026-09-28. 0 High, 7 Medium, 14 Low, 3 Spec. Skipped: stories, most specs (read only to judge coverage). A second pass covered `forms/form-field/headless/anchored-panel-controller.ts` and `forms/selection-list/headless/internals/selection-state.ts` in full.

## keyboard, typeahead

- Medium: typeahead does not cycle and always searches from the list start (`forms/select/headless/select.directive.ts:1346-1350`). Pressing `b` twice builds the buffer `bb` and matches nothing instead of moving to the second "b" option. Match repeated single characters from the item after the active one, as the APG listbox pattern does. S Verified.
- Medium: Space during a typeahead run commits the active option (`forms/select/headless/select.directive.ts:1115-1123`). Typing "new york" on an open select without search commits "New..." at the space. Append the space to the buffer while a typeahead run is in progress. S Verified.

## options, value comparison

- Medium: `SelectOptionDirective` gives `listItem.id` its generated id, but writes that id to the element only when the element has no id (`forms/select/headless/select-option.directive.ts:105`, `:129-131`). An option with a consumer `id` (static or bound) gets an `aria-activedescendant` that points at no element, so screen readers lose the active option. Read the id from the element, or always use the element's final id. S Verified.
- Low: an option's text label is read once in `afterNextRender` (`forms/select/headless/select-option.directive.ts:156-158`). When projected text changes later (`{{ user.name }}` after a reload, a locale switch) the trigger display, filtering and typeahead keep the old text until the option instance is recreated. Observe the text (MutationObserver or re-read on panel mount) or document `label` as required for dynamic text. M Re-rated from Medium: the `label` JSDoc documents the first-paint read, and panel options are recreated on each open, so only the closed trigger display stays stale.
- Medium: with a custom `compareWith`, the `options` sync is O(n^2) on every `options` change (`forms/select/headless/select.directive.ts:626-647`). A fresh array of new object instances (the normal API case) misses the exact-key lookup, so each entry scans the whole registry and `nextItems`; 5 000 options cost about 25M `compareWith` calls. This is the data-driven, virtualized path meant for large lists. Accept a key function, or index the registry by a key derived once per value. M Verified.

## async options

- Medium: `[etSelectOptions]` pushes the bundle once in `ngOnInit` (`forms/select/headless/select-options.directive.ts:67-71`). When the bound bundle changes (`[etSelectOptions]="mode() === 'a' ? usersA : usersB"`), `setQuery`/`loadMore` go to the new bundle while `loading`/`error`/`hasMore` still read the old one. Sync `asyncOptions` from the input in an effect. S Verified.

## groups

- Medium: a group whose options are all filtered out still renders its header (`forms/select/select-option-group.component.css:8-9`, `forms/select/headless/select-option-group.directive.ts:23`). The directive hides the group with the `hidden` attribute, but the author rule `et-select-option-group { display: block }` beats the UA `[hidden] { display: none }`, so a search shows empty group headers. The spec asserts only the attribute (`select-option-group.directive.spec.ts:58-63`). Add `&[data-hidden] { display: none; }` to the group rule. S Re-rated from High: cosmetic, and Tailwind v4 preflight (`[hidden] { display: none !important }`) masks it in Tailwind apps such as Storybook and ea-frontend.

## a11y

- Low: windowed data-driven rows have no `aria-setsize`/`aria-posinset` (`forms/select/headless/select-virtual-option.directive.ts:16-27`). Past 40 options a screen reader announces the count of rendered rows, not of all options. S
- Low: with a search input the trigger `div` loses its role but keeps `aria-label`, `aria-labelledby` and `aria-disabled` (`forms/select/headless/select-trigger.directive.ts:18-21`). ARIA prohibits a name on a generic element. Drop those attributes when `hasSearch()`. S

## bundle size

- Low: `SelectComponent` statically imports `SelectVirtualOptionComponent`, `SelectAllOptionComponent` and `ChipComponent` (`forms/select/select.component.ts:23-35`), and every `SelectDirective` creates a virtual window (`forms/select/headless/select.directive.ts:469-476`). A single select with projected options bundles the data-driven, select-all and multi-chip code. Measure first; a split needs an API decision. M
- Low: `select-option.component.css` is the stylesheet of three components (`forms/select/select-option.component.ts:7`, `forms/select/select-virtual-option.component.ts:30`, `forms/select/select-all-option.component.ts:22`). A panel with select-all and a projected option injects the same sheet twice, and the JS bundle carries it three times (gzip hides most of that). Mount it once through the style manager. S

## cleanup

- Low: the two query adapters duplicate the debounce, page reset, page fold, keepalive effect and `hasMore` logic (`forms/select/select-options-from-query.ts:104-181`, `forms/select/select-options-from-v2-query.ts`). Extract the shared paging core into `select-options-paging.ts`. M
- Low: both adapters fall back to the hardcoded English `'Something went wrong'` (`forms/select/select-options-from-query.ts:61`, `forms/select/select-options-from-v2-query.ts`), outside `SELECT_LABELS`. Add an `error` label. S
- Low: `SelectLabels` JSDoc names `customValues` (the input is `allowCustomValues`) and calls `create` "the confirm action" (it is the leading text of the "Create ..." row) (`forms/select/select-labels.ts:5`, `:16`). S
- Low: hardcoded colour as primary value in the panel shadow (`forms/select/select-panel.component.css:59`). Use a shadow token. S
- Low: comments outside the AGENTS.md allowlist: rationale and narration at `forms/select/headless/select.directive.ts:363`, `:901-902`, `:967`, `:1298-1299`, `:1374`, `:1467-1468`; `forms/select/headless/select-search.directive.ts:76-77`, `:170-172`, `:183-184`, `:200-201`; `forms/select/headless/select-options.directive.ts:69-70`; `forms/select/select-panel.component.ts:8-13`; `forms/select/select-option.component.ts:11-12`; `forms/select/select-virtual-option.component.ts:27-29`. S

## spec gaps

- Spec: no spec for an option with its own `id` and `aria-activedescendant`, nor for a swapped `[etSelectOptions]` bundle. S
- Spec: group hiding needs a Storybook/Playwright check on computed `display`, since jsdom does not apply the stylesheet. S

## panel controller and selection state (second pass)

- Medium: a Tab past the pane edge lets the browser move focus in DOM order, and the pane lives in the overlay root at the end of `body` (`forms/form-field/headless/anchored-panel-controller.ts:151-167`, `libs/core/src/lib/overlay/overlay-runtime.ts:82`). Tab from the last date-picker cell sends focus to the browser chrome, and Shift+Tab from the first sends it to the last focusable element of the page, not back near the field; `byFocusLeave` then stops the focus restore. On a Tab past the edge, prevent the default, focus the tabbable before or after the anchor, then close. M Verified.
- Low: when no surface is registered, `mountOverlay` returns but `open` stays `true` (`forms/form-field/headless/anchored-panel-controller.ts:176-180`). The trigger reports `aria-expanded="true"` with no panel, the next click only resets the model, and a surface that registers later never mounts, because the effect does not track `surface`. Set `open` to `false` after `onMissingSurface`. S
- Low: the controller JSDoc says the date pickers use the sibling `createDatePickerOverlay` (`forms/form-field/headless/anchored-panel-controller.ts:57-62`). `createDatePickerOverlay` calls this controller (`forms/date-time/internals/date-picker-overlay.ts:39`). Fix the sentence. S
- Low: `select`, `toggleAll` and the unregister prune build the multi value in registration order (`forms/selection-list/headless/internals/selection-state.ts:150-152`, `:200-204`, `:242-246`). An option that `@for` inserts in the middle of a list registers last, so its value lands at the end of the array, not at its display position. Sort by DOM position, or document the order. S
- Low: the comment at `forms/selection-list/headless/internals/selection-state.ts:69-74` narrates the old bug ("meant a single disabled-and-unchecked item pinned..."). Keep the one-line invariant and delete the history. S
- Spec: no spec asserts where focus lands after a Tab or Shift+Tab past the picker pane; `date-inputs.e2e.ts:260-274` checks only that the fields are not focused. S
