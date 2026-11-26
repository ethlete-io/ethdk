---
'@ethlete/query': patch
---

`createPagedQueryStack`: `direction()` reads `'next'` again after an args change reloads the stack, as it already did after `reset()`.
