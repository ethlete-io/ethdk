---
'@ethlete/components': patch
'@ethlete/core': minor
---

New `injectFileDownload()` and `createObjectUrlHandle()` in core replace four hand-rolled object URLs. The query devtools exports now append their anchor before clicking it, which Firefox ignored.
