---
'@ethlete/cli': patch
---

The stale cli build refusal of `et design` now also applies when it runs from a subfolder of the checkout, so `compare`, `check` and every other design command refuse a build made from other `libs/cli` sources.
