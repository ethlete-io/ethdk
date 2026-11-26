---
'@ethlete/query': patch
---

Persistence: a tab no longer hydrates a body that a build with another `version` wrote over the same key; custom adapters should return `version` from `read`.
