---
'@ethlete/query-devtools': patch
---

Query devtools exports stop carrying live credentials: a copied report slims its args, a session export omits auth-provider bodies and redacts credential-named keys, and an unchainable secure request drops its `Authorization`.
