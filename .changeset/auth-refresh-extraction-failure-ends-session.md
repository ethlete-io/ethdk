---
'@ethlete/query': patch
---

Auth: a refresh whose response yields no usable tokens - the extractor throws, or a custom `extractTokens` returns no token strings - now ends the session like a rejected refresh instead of keeping a session that every secure query `401`s against.
