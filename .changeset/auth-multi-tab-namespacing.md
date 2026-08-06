---
'@ethlete/query': patch
---

Bearer auth multi-tab sync: the broadcast channel and the leader lock are namespaced by the provider's `name`, so two providers on one origin no longer share a token channel and one leader.
