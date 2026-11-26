---
'@ethlete/components': minor
---

Select: new data-driven `options` input with built-in virtualization for large option lists.

- `options` takes `SelectOptionData[]` (`{ value, label, disabled? }`) - the select renders the rows itself and windows them, so only the rows near the viewport exist in the DOM (2000 options ≈ 15 rendered nodes). Internal filtering, keyboard navigation, typeahead and closed-panel label resolution work across the full data set.
- `etSelectOptionTemplate` customizes the row content of data-driven options, with the source entry (extra fields included) as template context.
- Headless: `etSelectViewport` marks the scroll container to window against, `etSelectVirtualOption` renders one windowed item, and `virtualizedItems()` / `virtualWindow` on `[etSelect]` expose the window state.
- Breaking for headless consumers of `SelectItem`: `elementRef` is now `element: Signal<HTMLElement | null>` (`null` for a data-driven option outside the rendered window).
