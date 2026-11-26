---
'@ethlete/cli': patch
---

`design` refuses to run from a build whose libs/cli sources changed since it was built, and names `NX_NO_CLOUD=true npx nx build cli`. The build records a content hash of the sources in `build-info.json`.
