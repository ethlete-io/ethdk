---
'@ethlete/components': patch
---

The `syncUrl` JSDoc on `provideOverlayRouter` no longer claims deep-link support. The query param key is per instance, so a URL cannot restore an overlay route.
