---
'@ethlete/contentful': patch
---

The rich text renderer skips an embedded asset whose file has a content type but no URL, instead of mounting an empty image, video, audio or file component for it.
