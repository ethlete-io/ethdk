---
'@ethlete/contentful': patch
---

`provideContentfulConfig()` falls back to the defaults for `internalHosts`, `customComponents` and image options passed as `undefined`, instead of crashing links and embedded entries.
