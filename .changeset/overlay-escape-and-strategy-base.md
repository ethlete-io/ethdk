---
'@ethlete/components': patch
'@ethlete/core': patch
---

Let overlay content handle `Escape` first, so the command palette clears its query
before closing. A `strategies` array without a breakpoint-less entry now falls back
to its smallest one instead of throwing.
