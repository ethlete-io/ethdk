---
'@ethlete/cli': patch
---

`et update` hands the migrations to the newly installed `et` when the update moves `@ethlete/cli`, so steps a newer CLI added, such as the agent rules sync, run in that same update.
