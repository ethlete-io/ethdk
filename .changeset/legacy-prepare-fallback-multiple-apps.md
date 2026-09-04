---
'@ethlete/query': patch
---

`provideLegacyPrepareFallback()`: with several applications on one page the first one to provide it stays the fallback, destroying a later one no longer breaks it, and dev mode warns.
