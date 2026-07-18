---
'@ethlete/components': minor
---

Cascader: multi-select via the new `multiple` input — activations toggle values (the form value becomes a `T[]`), the panel stays open, rows gain check squares and unselected ancestors of a selection show an indeterminate dash. Search results toggle in place (keeping the result list), the trigger joins the selected labels, and programmatic values resolve their chains through `resolvePath`. The `value` model is now typed `T | T[] | null`.
