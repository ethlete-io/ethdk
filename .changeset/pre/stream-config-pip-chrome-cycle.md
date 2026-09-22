---
'@ethlete/components': patch
---

Stream: `provideStreamConfig({ pipChromeComponent })` now defaults to `null` (meaning the built-in chrome) rather than to the component itself, which put a circular import between the stream config and the pip window.
