---
'@ethlete/components': minor
---

- `et-radio-group`, `et-checkbox-group` and `et-segmented-button-group` take a `compareWith` input with the same signature and `===` default as the select's, so object values loaded from an API check their options.
- `et-select` and `et-cascader` take the `pending` and `maxLength` inputs that signal forms binds: an async validator shows the field's busy state, and `<et-counter />` counts selected values against the schema's `maxLength()`. The selection-list groups take `pending` too.
- An `et-radio`, `et-checkbox-option` or `et-segmented-button` outside its group throws `ET5200`, `ET5201` or `ET5202` in dev mode. The bare `etSelectionOption` still works on its own.
- A paste into a multi `et-select` with `customValueSeparators` splits on single characters only, so `['Enter', ',']` no longer splits on every letter of `Enter`. Longer entries log a dev-mode warning.
- A paste into `et-select` is spliced into the text in the field at the caret, as in the tag input.
