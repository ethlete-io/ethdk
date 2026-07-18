---
'@ethlete/components': minor
---

Cascader: multi-select via the new `multiple` input — activations toggle values (the form value becomes a `T[]`), the panel stays open, rows gain check squares, ancestors of a partial selection show an indeterminate dash and promote to a full checkmark once all their loaded descendants are selected. Search results toggle in place (keeping the result list), the trigger joins the selected labels, and programmatic values resolve their chains through `resolvePath`. The `value` model is now typed `T | T[] | null`.
