---
'@ethlete/query': patch
---

Auth: a token refresh whose response yields no usable tokens now ends the session, instead of keeping one that every secure query `401`s against.
