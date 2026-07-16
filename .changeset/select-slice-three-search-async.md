---
'@ethlete/components': minor
---

Select: search and async options.

- `input[etSelectSearch]` turns the select into a searchable combobox — rendered inline in the field (after the chips in multi mode, tag-input style), it owns the combobox ARIA and the tab stop; typing opens and filters, the first Escape clears the query, the second closes, and the query clears on close and when a multi commit adds a value.
- `filterMode` (`'internal'` default) hides non-matching options client-side; `'external'` leaves the option list to the consumer via the new `queryChange` output.
- Async states as inputs: `loading`, `error`, `hasMoreItems` render default panel rows (spinner / alert / load-more emitting `loadMoreRequested`), each overridable via `ng-template[etSelectLoading]` / `[etSelectError]` / `[etSelectEmpty]`.
- `allowCustomValues` commits an unmatched query string as the value on Enter (multi: becomes a chip, search clears).
- Fixed: a multi commit no longer drops selected values that have no rendered option (custom values, externally filtered options).
- `selectOptionsFromQuery(...)` feeds options from an `@ethlete/query` query with debouncing, `minQueryLength`, error mapping and `toHasMore` pagination.
- `ng-template[etSelectValue]` now receives selected entries (`{ value, label, item }`) instead of live items, coexists with an inline search (typing hides it in single mode, the input never displays the label and clearing the query doesn't deselect) — rich value displays like a country select with flags work searchable.
- Single select with search: the input doubles as the value display — it shows the selected label (text-selected on open so typing replaces it), restores it on close, and erasing all of its text deselects the value.
- The panel animates its block size when content changes while open; the trigger chevron is static.
- A clear (×) control shows while the focused (or open) field has a value (`clearable`, default true; `clearLabel` for its aria-label), and Backspace on an empty search input deletes the last selected value (last chip in multi mode).
