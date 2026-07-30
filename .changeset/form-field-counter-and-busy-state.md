---
'@ethlete/components': minor
---

Form field: add `<et-counter />` — an `x / N` character counter in the support region, at the inline-end of the hint/error and persistent alongside them. It takes its limit from the bound field's schema `maxLength()`, or an explicit `[max]`, and counts array values (so it counts tags in an `et-tag-input`) via `lengthOf`.

The field also shows a subtle busy spinner and `aria-busy` while an async validator is pending, plus `[busy]` on `et-form-field` to force it.
