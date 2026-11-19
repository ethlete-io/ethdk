---
'@ethlete/core': patch
---

Stop `MetaStore.addTag` and `removeTag` from tracking the current locale when called inside an `effect()`.
