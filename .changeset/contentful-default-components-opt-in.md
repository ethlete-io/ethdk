---
'@ethlete/contentful': major
---

Breaking: `provideContentfulConfig` no longer registers the asset and link components; add `features: [withContentfulDefaultComponents()]` to keep them. `et update` migrates existing calls.
