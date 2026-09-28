---
'@ethlete/components': patch
---

A readonly dropzone keeps its drop area focusable (`aria-disabled` instead of `disabled`), so `focus()` and Tab reach it, including with a single readonly file; activating it still opens nothing.
