---
'@ethlete/components': minor
---

The table now throws `ET3512` in dev mode for a column flag without its feature, and `ET3513` for a CSV value with no text form. `hasMore` holds while a page loads.

Bar and line charts warn in dev mode on `data` that does not fit `series`. `GridDirective.addItem()` returns the new id.
