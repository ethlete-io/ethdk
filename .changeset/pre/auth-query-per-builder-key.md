---
'@ethlete/query': patch
---

Bearer auth: each registry key now reuses one query across executions, so logins and token refreshes stop leaking an injector, an effect and cached credentials per attempt.
