---
'@ethlete/components': patch
---

`createDefaultDropzoneArgs` now returns `{ body: FormData }`, so a custom `createArgs` can reuse its `body` without a cast.
