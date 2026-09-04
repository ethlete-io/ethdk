---
'@ethlete/query': patch
---

`withLongPolling`: the first round of a chain (the one the `withArgs` source starts) is no longer kept for `keepUnusedFor` after the chain moves on - every round now runs with retention off, as documented.
