---
'@ethlete/contentful': patch
---

`et-contentful-image` and `generateDefaultContentfulImageSource` keep the fallback `<img>` for an asset with a URL but no content type, instead of rendering no image.
