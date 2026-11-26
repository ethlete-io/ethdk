---
'@ethlete/components': patch
---

Loaders: a non-numeric `value` on `et-spinner` or `et-progress-bar` renders as 0 instead of `aria-valuenow="NaN"`, and the spinner's geometry signals are no longer public.
