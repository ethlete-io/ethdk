---
'@ethlete/query': patch
---

A secure interop query that waits for a token no longer reports its own request as an `auto` refresh once the token arrives; the load keeps the trigger it was started with.
