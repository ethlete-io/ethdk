---
'@ethlete/cli': patch
'@ethlete/cli-core': patch
'ethlete-studio': patch
---

The stale-build guard and Studio's outdated-cli check now also see an edit to `libs/cli/package.json`, which the build copies into the dist.
