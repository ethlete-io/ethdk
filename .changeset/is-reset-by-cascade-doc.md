---
'@ethlete/query': patch
---

Query forms: document the `isResetBy` cascade correctly - a cyclic graph converges on its own, and only a chain deeper than ten hops reaches the pass cap and warns.
