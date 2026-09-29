---
'@ethlete/contentful': major
---

Breaking: `provideContentfulConfig` no longer registers the asset and link components; spread `CONTENTFUL_DEFAULT_COMPONENTS` into it to keep them. `et update` migrates existing calls.
