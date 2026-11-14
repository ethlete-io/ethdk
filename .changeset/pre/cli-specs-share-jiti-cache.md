---
'@ethlete/cli': none
---

The cli specs share one jiti cache for the workers they start, so a busy runner no longer times out transpiling the worker sources in every spec file.
