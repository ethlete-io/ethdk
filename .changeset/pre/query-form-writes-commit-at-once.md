---
'@ethlete/query': minor
---

`defineQueryForm` writes from code (`setValue`, `patchValue`, resets) now commit at once, skipping the field debounce, so `value()` is current on the next line; pass `{ debounce: true }` to keep the debounce.
