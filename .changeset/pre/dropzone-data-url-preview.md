---
'@ethlete/components': patch
---

Dropzone image previews are `data:` URLs instead of `blob:` URLs, so they show under an `img-src` that does not allow `blob:`.
