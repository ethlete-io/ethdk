---
'@ethlete/components': patch
---

`setupComponentsTestEnvironment()` now stubs `Element.prototype.scroll`, which `et-carousel` calls.
