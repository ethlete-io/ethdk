---
'@ethlete/query': patch
---

An interop mutation whose prepare injector is destroyed while its request is in flight now finishes before it is destroyed, as it did in v2.
