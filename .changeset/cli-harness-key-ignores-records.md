---
'@ethlete/cli': patch
---

The harness build cache key no longer includes plans, changesets and the JSON records under `.ethlete/design` (sketches, pictures, comments), which the build does not read, so editing them keeps the cached build.
