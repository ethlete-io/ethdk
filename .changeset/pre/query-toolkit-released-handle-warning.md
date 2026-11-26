---
'@ethlete/query': patch
---

`refresh()` and `startPolling()` on a toolkit handle a newer unhashable-args call released now do nothing and warn once, naming the release, instead of warning on every call or polling tick.
