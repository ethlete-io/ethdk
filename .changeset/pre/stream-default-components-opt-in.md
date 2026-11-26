---
'@ethlete/components': major
---

Breaking: the stream loading and error overlays are opt-in and no longer in `STREAM_IMPORTS`; spread `STREAM_DEFAULT_COMPONENTS` into `provideStreamConfig` to keep them. `et update` migrates both.
