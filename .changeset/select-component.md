---
'@ethlete/components': minor
---

Select: new `et-select` form control - a combobox-pattern trigger opening an anchored, width-mirrored listbox panel (`SELECT_IMPORTS`, plus the headless `[etSelect]` / `[etSelectTrigger]` / `ng-template[etSelectSurface]` / `[etSelectListbox]` / `[etSelectOption]` graph and `et-select-panel` / `et-select-option`). Integrates with `et-form-field` (new `select` control type, all label modes).

- Single select: full keyboard model - arrows/Home/End move virtual focus via `aria-activedescendant`, Enter/Space commit, typeahead while open, printable keys commit directly while closed; resolves a preselected value's label without ever opening the panel.
- Multi select (`multiple`): array value, options toggle without closing (`aria-multiselectable`), selection shown as removable `et-chip`s; `deselectOption(...)` and a customizable `ng-template[etSelectValue]`.
- Search (`input[etSelectSearch]`): inline searchable combobox; `filterMode` `'internal'` (default) or `'external'` (via the `queryChange` output), `allowCustomValues`, and `selectOptionsFromQuery(...)` to feed options from an `@ethlete/query` query (debounce, `minQueryLength`, `toHasMore` pagination).
- Async state inputs `loading` / `error` / `hasMoreItems` render default panel rows (spinner / alert / load-more via `loadMoreRequested`), each overridable through `ng-template[etSelectLoading]` / `[etSelectError]` / `[etSelectEmpty]`.
- `allowAddNew` shows an "Add new" row emitting `addNewRequested` with the current query (`addNewLabel`); a `clearable` (×) control clears the value; clicking anywhere on the control frame opens the panel.
- Options render with `content-visibility: auto` and animated hover so panels with thousands of options stay responsive; the panel animates its block size on content change.
- `readonly` chips (select and tag input) keep their normal look and drop the remove button; disabled form fields no longer show hover feedback.
- Form field exposes `controlFrameElement` on its contract so overlay-based controls can anchor their panels to the visible box.
