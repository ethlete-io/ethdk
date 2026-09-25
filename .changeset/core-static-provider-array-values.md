---
'@ethlete/core': patch
---

`defineStaticProvider` and `defineStaticRootProvider` now replace an array or other non-object default with the override, instead of spreading the array into an object. Only two plain objects are merged.
