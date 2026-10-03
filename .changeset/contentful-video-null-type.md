---
'@ethlete/contentful': patch
---

`et-contentful-video` leaves the `type` off its `<source>` for an asset without a content type, instead of writing `type="null"`, which no browser plays.
