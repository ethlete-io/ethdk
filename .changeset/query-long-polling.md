---
'@ethlete/query': minor
---

Add the `withLongPolling` query feature: each round starts once the previous one settled, with args derived from its response, and a failed round is repeated with a growing delay.
