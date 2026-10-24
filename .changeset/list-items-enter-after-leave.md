---
'@ethlete/core': patch
'@ethlete/components': patch
---

`injectAnimatedListItems` fades a new item in only after the removed items have faded out, so a select's "No results" or loading row cross-fades with the options instead of overlapping them.
