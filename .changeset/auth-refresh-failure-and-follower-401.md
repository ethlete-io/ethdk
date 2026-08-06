---
'@ethlete/query': minor
---

A refresh that fails for good now ends the session instead of leaving it looking valid - override with `onRefreshFailure`. A 401 in a follower tab asks the leader to refresh, and is no longer throttled by `minRefreshInterval`.
