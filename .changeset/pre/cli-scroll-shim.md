---
'@ethlete/cli': patch
---

Design draws no longer fail on components that scroll: the server render shims `Element.scroll`, `scrollTo` and `scrollBy` as no-ops.
