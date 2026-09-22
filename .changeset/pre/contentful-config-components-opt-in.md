---
'@ethlete/contentful': major
---

The built-in embedded components now only exist when `provideContentfulConfig()` is in scope - without it embedded assets are skipped and hyperlinks render as plain `<a href>`. Apps that render embedded content must add the provider (no arguments is enough). In exchange, `ContentfulLinkComponent` and text-only rich text no longer bundle the image/video/audio/file components.
