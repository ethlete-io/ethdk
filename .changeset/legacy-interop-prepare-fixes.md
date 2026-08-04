---
'@ethlete/query': patch
---

Legacy interop fixes: `destroyOnResponse` no longer strands its watcher on an aborted query, an `entity`
config no longer syncs a `null` response on `prepare()`, and a falsy `body` is sent instead of dropped.
