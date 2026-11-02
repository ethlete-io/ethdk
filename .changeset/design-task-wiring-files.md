---
'@ethlete/cli': patch
---

`et design task --verify` skips files under `.ethlete/design` with one summary line and allows the part's wiring files (the app files importing the part and their direct imports), which `et design task` now lists.
