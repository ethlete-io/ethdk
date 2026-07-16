---
'@ethlete/components': minor
---

Select: multi-select. With `multiple`, `value` is an array, options toggle without closing the panel (`aria-multiselectable` listbox), and the trigger renders the selection as removable `et-chip`s.

- New `ng-template[etSelectValue]` replaces the trigger's default label/chips display with a custom template (selected items as context); `SelectDirective.deselectOption(...)` deselects programmatically.
- The `et-select` trigger is now a `role="combobox"` div instead of a native button (chips carry remove buttons, which cannot nest in a button); the trigger directive manages `tabindex`/`aria-disabled` for non-button hosts.
- Fixed: options whose bindings resolve after registration (projected content) are now picked up by the value↔selection sync — a pre-filled multi select renders its chips on initial load.
