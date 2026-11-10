---
'@ethlete/query': patch
---

The v3 migration names every `gqlQuery` and `gqlMutate` call in a task, also on an aliased client, in a class property or
inside a function, and warns about the implicit-any errors (TS7006) they leave.
