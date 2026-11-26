---
'@ethlete/query': patch
---

Fall back to five retained bodies when `provideQueryDevtools({ responseHistory })` is `NaN`, instead of dropping every body.
