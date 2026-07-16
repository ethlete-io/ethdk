---
'@ethlete/components': minor
---

Select: new `et-select` form control (single select) — a combobox-pattern trigger opening an anchored, width-mirrored listbox panel. Exported as `SELECT_IMPORTS` with the full headless graph (`[etSelect]`, `[etSelectTrigger]`, `ng-template[etSelectSurface]`, `[etSelectListbox]`, `[etSelectOption]`) plus `et-select-panel` and `et-select-option`.

- Full keyboard support: arrows/Home/End move virtual focus (`aria-activedescendant` — DOM focus stays on the trigger), Enter/Space commit, Escape/Tab/outside click close, typeahead while open; printable characters commit directly while closed like a native `<select>`.
- Integrates with `et-form-field` (new `select` control type, all label modes) and resolves a preselected value's label without the panel ever having been opened.
- Form field: the field's control frame is now exposed as `controlFrameElement` on the form-field contract, so overlay-based controls can anchor their panels to the visible box.
