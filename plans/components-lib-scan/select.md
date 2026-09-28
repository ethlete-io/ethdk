# forms/select scan - open findings

Scan of `libs/components/src/lib/forms/select/` from 2026-09-28. 0 High, 1 Medium, 7 Low, 0 Spec. Skipped: stories, most specs (read only to judge coverage). A second pass covered `forms/form-field/headless/anchored-panel-controller.ts` and `forms/selection-list/headless/internals/selection-state.ts` in full.

## options, value comparison

- Low: an option's text label is read once in `afterNextRender` (`forms/select/headless/select-option.directive.ts:156-158`). When projected text changes later (`{{ user.name }}` after a reload, a locale switch) the trigger display, filtering and typeahead keep the old text until the option instance is recreated. Observe the text (MutationObserver or re-read on panel mount) or document `label` as required for dynamic text. M Re-rated from Medium: the `label` JSDoc documents the first-paint read, and panel options are recreated on each open, so only the closed trigger display stays stale.
- Medium: with a custom `compareWith`, the `options` sync is O(n^2) on every `options` change (`forms/select/headless/select.directive.ts:626-647`). A fresh array of new object instances (the normal API case) misses the exact-key lookup, so each entry scans the whole registry and `nextItems`; 5 000 options cost about 25M `compareWith` calls. This is the data-driven, virtualized path meant for large lists. Accept a key function, or index the registry by a key derived once per value. M Verified.

## a11y

- Low: windowed data-driven rows have no `aria-setsize`/`aria-posinset` (`forms/select/headless/select-virtual-option.directive.ts:16-27`). Past 40 options a screen reader announces the count of rendered rows, not of all options. S
- Low: with a search input the trigger `div` loses its role but keeps `aria-label`, `aria-labelledby` and `aria-disabled` (`forms/select/headless/select-trigger.directive.ts:18-21`). ARIA prohibits a name on a generic element. Drop those attributes when `hasSearch()`. S

## bundle size

- Low: `SelectComponent` statically imports `SelectVirtualOptionComponent`, `SelectAllOptionComponent` and `ChipComponent` (`forms/select/select.component.ts:23-35`), and every `SelectDirective` creates a virtual window (`forms/select/headless/select.directive.ts:469-476`). A single select with projected options bundles the data-driven, select-all and multi-chip code. Measure first; a split needs an API decision. M

## cleanup

- Low: hardcoded colour as primary value in the panel shadow (`forms/select/select-panel.component.css:59`). Use a shadow token. S

## panel controller and selection state (second pass)

- Low: when no surface is registered, `mountOverlay` returns but `open` stays `true` (`forms/form-field/headless/anchored-panel-controller.ts:176-180`). The trigger reports `aria-expanded="true"` with no panel, the next click only resets the model, and a surface that registers later never mounts, because the effect does not track `surface`. Set `open` to `false` after `onMissingSurface`. S
- Low: `select`, `toggleAll` and the unregister prune build the multi value in registration order (`forms/selection-list/headless/internals/selection-state.ts:150-152`, `:200-204`, `:242-246`). An option that `@for` inserts in the middle of a list registers last, so its value lands at the end of the array, not at its display position. Sort by DOM position, or document the order. S
