---
'@ethlete/components': patch
---

Fix the select panel opening too tall (and animating down) when a consumer adds block padding to `.et-select-option` - the offscreen placeholder size no longer stacks on top of the row height.
