---
'@ethlete/contentful': patch
---

`provideContentfulConfig` now merges `components` and `imageOptions` one level deep, so overriding one component keeps the other defaults.
