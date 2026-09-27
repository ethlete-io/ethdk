---
'@ethlete/core': patch
---

`getScrollItemTarget` no longer rounds a half-visible item up to fully visible, so element-mode paging in a scrollable lands on that item instead of skipping it.
