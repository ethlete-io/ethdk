---
'@ethlete/cli': patch
---

`design check` keeps its render and completeness caches across a resident restart: the Vite client's per-start websocket token and inline source maps no longer change a cache key.
