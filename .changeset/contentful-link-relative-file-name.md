---
'@ethlete/contentful': patch
---

`et-contentful-link` resolves query-only and relative hrefs against the current router URL. The file link and audio caption fall back to the file name when the asset has no title; the GQL asset fragment selects `fileName`.
