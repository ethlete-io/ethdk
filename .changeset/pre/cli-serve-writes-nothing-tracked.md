---
'@ethlete/cli': patch
---

`et design serve` and `et design check` keep their check records in the gitignored `.ethlete/cache/<product>/stamps/ready.json`, so only `et design ready` changes `ready.json`.
