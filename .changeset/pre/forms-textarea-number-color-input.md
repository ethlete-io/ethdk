---
'@ethlete/components': minor
---

Forms: three new form-field controls and a small headless API addition.

- `et-textarea` (+ headless `TextareaDirective`): multi-line plain-text control with autosize on by default (`rows`, `minRows`, `maxRows`, `resize`).
- `et-number-input` (+ headless `NumberInputDirective`): numeric input whose form value is `number | null` (empty reads as `null`), with `min`/`max`/`step`; native spin buttons hidden.
- `et-color-input` (+ headless `ColorInputDirective`): native color picker as a swatch + hex value, form value `'#rrggbb' | null`; tokens `--et-color-input-swatch-size` / `--et-color-input-swatch-radius`.
- `InputDirective` (and the new input directives) now expose a public `nativeControl` signal referencing the native element, for integrations such as input masking.
